import { createClient } from "@supabase/supabase-js";
import { buildFraudHeaders } from "../../hmrc/fraudHeaders";

// =========================
// 🔧 CONFIG
// =========================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const HMRC_BASE =
  process.env.HMRC_BASE_URL || "https://test-api.service.hmrc.gov.uk";

// =========================
// 🚀 HANDLER
// =========================
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    // =========================
    // 1️⃣ READ BODY
    // =========================
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const { user_id, nino, utr, income, expenses } = body || {};

    console.log("Incoming body:", body);

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    if (!nino) {
      return res.status(400).json({ error: "Missing NINO" });
    }

    const cleanNino = nino.replace(/\s/g, "").toUpperCase();

    // =========================
    // 2️⃣ GET TOKEN FROM DB
    // =========================
    const { data: token, error: tokenError } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (tokenError || !token) {
      return res.status(401).json({ error: "No HMRC token found" });
    }

    let accessToken = token.access_token;

    // =========================
    // 3️⃣ REFRESH TOKEN IF EXPIRED
    // =========================
    const isExpired = new Date() >= new Date(token.expires_at);

    if (isExpired) {
      console.log("Token expired, refreshing...");

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
        console.error("Refresh failed:", newTokens);
        return res.status(401).json(newTokens);
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
        })
        .eq("user_id", user_id);

      accessToken = newTokens.access_token;
    }

    // =========================
    // 4️⃣ FRAUD HEADERS
    // =========================
    const fraudHeaders = buildFraudHeaders(req, user_id);

    // =========================
    // 5️⃣ TEST HMRC API CALL
    // =========================
    const url = `${HMRC_BASE}/individuals/self-assessment/obligations?from=2024-04-06&to=2025-04-05`;

    console.log("Calling HMRC with token:", accessToken?.slice(0, 10));

    const hmrcResponse = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.hmrc.1.0+json",
        ...fraudHeaders,
      },
    });

    const data = await hmrcResponse.json();

    if (!hmrcResponse.ok) {
      console.error("HMRC error:", data);
      return res.status(hmrcResponse.status).json({
        error: "HMRC API failed",
        details: data,
      });
    }

    // =========================
    // ✅ SUCCESS
    // =========================
    return res.status(200).json({
      success: true,
      message: "HMRC connection working",
      nino_used: cleanNino,
      data,
    });

  } catch (err) {
    console.error("Submit error:", err);
    return res.status(500).json({
      error: err.message || "Internal server error",
    });
  }
}
