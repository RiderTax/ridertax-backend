import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // ✅ FIXED KEY NAME
);

export default async function handler(req, res) {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    // 🔍 Get existing tokens
    const { data: tokenData, error } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (error || !tokenData) {
      return res.status(404).json({ error: "No token found" });
    }

    // 🔁 Refresh token from HMRC
    const response = await axios.post(
      "https://test-api.service.hmrc.gov.uk/oauth/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.HMRC_CLIENT_ID,
        client_secret: process.env.HMRC_CLIENT_SECRET,
        refresh_token: tokenData.refresh_token,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const newTokens = response.data;

    // ✅ CRITICAL FIX — calculate expiry properly
    const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

    // 💾 Update DB
    const { error: updateError } = await supabase
      .from("hmrc_tokens")
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at: expiresAt.toISOString(), // ✅ THIS FIXES YOUR ISSUE
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user_id);

    if (updateError) {
      console.error("DB update error:", updateError);
      return res.status(500).json({ error: "Failed to update token" });
    }

    return res.json({
      success: true,
      expires_at: expiresAt,
    });

  } catch (err) {
    console.error("Refresh error:", err.response?.data || err.message);
    return res.status(500).json({
      error: "Token refresh failed",
      details: err.response?.data || err.message,
    });
  }
}
