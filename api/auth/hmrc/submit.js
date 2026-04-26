import { createClient } from "@supabase/supabase-js";
import { buildFraudHeaders } from "../../hmrc/fraudHeaders";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const HMRC_BASE =
  process.env.HMRC_BASE_URL || "https://test-api.service.hmrc.gov.uk";

export default async function handler(req, res) {
  // ✅ CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const userId = req.query.user_id;

    if (!userId) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    // =========================
    // 1️⃣ GET TOKEN
    // =========================
    const { data: token, error } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !token) {
      return res.status(401).json({ error: "No HMRC token found" });
    }

    let accessToken = token.access_token;

    // =========================
    // 2️⃣ REFRESH TOKEN
    // =========================
    const isExpired = new Date() >= new Date(token.expires_at);

    if (isExpired) {
      const refreshResponse = await fetch(`${HMRC_BASE}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: token.refresh_token,
          client_id: process.env.HMRC_CLIENT_ID,
          client_secret: process.env.HMRC_CLIENT_SECRET,
        }),
      });

      const newTokens = await refreshResponse.json();

      if (!refreshResponse.ok) {
        return res.status(401).json({
          error: "Token refresh failed",
          details: newTokens,
        });
      }

      const newExpiry = new Date(
        Date.now() + newTokens.expires_in * 1000
      ).toISOString();

      await supabase
        .from("hmrc_tokens")
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at: newExpiry,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      accessToken = newTokens.access_token;
    }

    // =========================
    // 3️⃣ FRAUD HEADERS
    // =========================
    const fraudHeaders = buildFraudHeaders(req, userId);

    // =========================
    // 4️⃣ HMRC API CALL (FIXED)
    // =========================

    const nino = "AA123456A"; // HMRC sandbox test user

    const endpoint = `/obligations/details/${nino}?from=2024-04-06&to=2025-04-05`;
    const url = `${HMRC_BASE}${endpoint}`;

    console.log("➡️ Calling HMRC:", url);

    const hmrcResponse = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.hmrc.3.0+json", // ✅ IMPORTANT
        ...fraudHeaders,
      },
    });

    const responseText = await hmrcResponse.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    // =========================
    // 5️⃣ AUDIT LOG
    // =========================
    await supabase.from("hmrc_logs").insert({
      user_id: userId,
      endpoint,
      method: "GET",
      request_headers: fraudHeaders,
      request_body: null,
      response_status: hmrcResponse.status,
      response_body: data,
      created_at: new Date().toISOString(),
    });

    // =========================
    // 6️⃣ ERROR HANDLING
    // =========================
    if (!hmrcResponse.ok) {
      return res.status(hmrcResponse.status).json({
        error: "HMRC request failed",
        details: data,
      });
    }

    // =========================
    // 7️⃣ SUCCESS
    // =========================
    return res.status(200).json({
      success: true,
      data,
    });

  } catch (err) {
    console.error("❌ Submit error:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
}
