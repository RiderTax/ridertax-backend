import { createClient } from "@supabase/supabase-js";
import { buildFraudHeaders } from "./fraudHeaders";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // ✅ CORS FIX (CRITICAL)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    // =========================
    // 1️⃣ GET TOKEN
    // =========================
    const { data: token, error } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (error || !token) {
      return res.status(401).json({ error: "No HMRC token found" });
    }

    const accessToken = token.access_token;

    // =========================
    // 2️⃣ BUILD FRAUD HEADERS
    // =========================
    const fraudHeaders = buildFraudHeaders(req, user_id);

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      ...fraudHeaders,
    };

    console.log("➡️ Sending headers to HMRC:", headers);

    // =========================
    // 3️⃣ CALL HMRC VALIDATOR
    // =========================
    const response = await fetch(
      "https://test-api.service.hmrc.gov.uk/test/fraud-prevention-headers/validate",
      {
        method: "GET",
        headers,
      }
    );

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    console.log("⬅️ HMRC response:", data);

    // =========================
    // 4️⃣ HANDLE HMRC ERRORS
    // =========================
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "HMRC validation failed",
        details: data,
      });
    }

    // =========================
    // 5️⃣ SUCCESS
    // =========================
    return res.status(200).json({
      success: true,
      data,
    });

  } catch (err) {
    console.error("❌ HMRC ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
