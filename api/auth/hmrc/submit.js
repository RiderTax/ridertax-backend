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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    // =========================
    // 1️⃣ GET TOKEN
    // =========================
    const { data: token } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (!token) {
      return res.status(401).json({ error: "No HMRC token found" });
    }

    let accessToken = token.access_token;

    // =========================
    // 2️⃣ REFRESH TOKEN
    // =========================
    const isExpired = new Date() >= new Date(token.expires_at);

    if (isExpired) {
      console.log("🔄 Refreshing token...");

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
    // 3️⃣ FRAUD HEADERS
    // =========================
    const fraudHeaders = buildFraudHeaders(req, user_id);

    // =========================
    // 4️⃣ GET FRONTEND DATA ✅
    // =========================
    const { income, expenses } = req.body || {};

    console.log("📥 Incoming data:", { income, expenses });

    // Safety fallback
    const turnover = Number(income || 0);
    const totalExpenses = Number(expenses || 0);

    // =========================
    // 5️⃣ HMRC SUBMISSION
    // =========================
    const nino = "AT907078C"; // sandbox user
    const businessId = "XBIT00479532773";

    const endpoint = `/income-tax/nino/${nino}/sources/${businessId}/periodic-summaries`;
    const url = `${HMRC_BASE}${endpoint}`;

    const body = {
      from: "2024-04-06",
      to: "2024-07-05",
      financials: {
        incomes: {
          turnover,
        },
        expenses: {
          consolidatedExpenses: totalExpenses,
        },
      },
    };

    console.log("🚀 Submitting to HMRC:", url);
    console.log("📤 Payload:", body);

    const hmrcResponse = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.hmrc.1.0+json",
        ...fraudHeaders,
      },
      body: JSON.stringify(body),
    });

    const responseText = await hmrcResponse.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    // =========================
    // 6️⃣ AUDIT LOG
    // =========================
    await supabase.from("hmrc_logs").insert({
      user_id,
      endpoint,
      method: "POST",
      request_headers: fraudHeaders,
      request_body: body,
      response_status: hmrcResponse.status,
      response_body: data,
      created_at: new Date().toISOString(),
    });

    // =========================
    // 7️⃣ ERROR HANDLING
    // =========================
    if (!hmrcResponse.ok) {
      console.error("❌ HMRC Error:", data);

      return res.status(hmrcResponse.status).json({
        error: "Submission failed",
        details: data,
      });
    }

    // =========================
    // 8️⃣ SUCCESS
    // =========================
    console.log("✅ Submission successful");

    return res.status(200).json({
      success: true,
      message: "Submitted to HMRC successfully",
      data,
    });

  } catch (err) {
    console.error("❌ Submission error:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
}
