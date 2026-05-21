import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // =========================
    // ✅ CORS
    // =========================
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    // =========================
    // ✅ ONLY POST
    // =========================
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id",
      });
    }

    console.log("🔄 REFRESH START:", user_id);

    // =========================
    // ✅ GET EXISTING TOKENS
    // =========================
    const { data: tokenRow, error: tokenError } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (tokenError) {
      console.error("❌ TOKEN FETCH ERROR:", tokenError);

      return res.status(500).json({
        success: false,
        error: "Database error",
      });
    }

    if (!tokenRow) {
      return res.status(404).json({
        success: false,
        error: "No HMRC connection found",
      });
    }

    // =========================
    // ✅ CHECK IF TOKEN STILL VALID
    // =========================
    const now = new Date();
    const expiry = new Date(tokenRow.expires_at);

    // 5 minute safety buffer
    const fiveMinutes = 5 * 60 * 1000;

    if (expiry.getTime() - now.getTime() > fiveMinutes) {
      console.log("✅ TOKEN STILL VALID");

      return res.status(200).json({
        success: true,
        refreshed: false,
        access_token: tokenRow.access_token,
        expires_at: tokenRow.expires_at,
      });
    }

    console.log("⚠️ TOKEN EXPIRED → REFRESHING");

    // =========================
    // ✅ REFRESH TOKEN REQUEST
    // =========================
    const tokenResponse = await axios.post(
      `${process.env.HMRC_BASE_URL}/oauth/token`,
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.HMRC_CLIENT_ID,
        client_secret: process.env.HMRC_CLIENT_SECRET,
        refresh_token: tokenRow.refresh_token,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const tokens = tokenResponse.data;

    console.log("✅ TOKEN REFRESH SUCCESS");

    // =========================
    // ✅ CALCULATE NEW EXPIRY
    // =========================
    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    // =========================
    // ✅ UPDATE DATABASE
    // =========================
    const { error: updateError } = await supabase
      .from("hmrc_tokens")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user_id);

    if (updateError) {
      console.error("❌ UPDATE ERROR:", updateError);

      return res.status(500).json({
        success: false,
        error: "Failed to update tokens",
      });
    }

    // =========================
    // ✅ SUCCESS RESPONSE
    // =========================
    return res.status(200).json({
      success: true,
      refreshed: true,
      access_token: tokens.access_token,
      expires_at: expiresAt,
    });

  } catch (err) {
    console.error(
      "💥 REFRESH ERROR:",
      err?.response?.data || err.message
    );

    return res.status(500).json({
      success: false,
      error:
        err?.response?.data ||
        err.message ||
        "Refresh failed",
    });
  }
}
