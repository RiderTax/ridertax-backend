import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY
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

    // 🔁 Refresh token
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

    // 💾 Update DB
    await supabase
      .from("hmrc_tokens")
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_in: newTokens.expires_in,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user_id);

    return res.json({ success: true });

  } catch (err) {
    console.error("Refresh error:", err.response?.data || err.message);
    return res.status(500).json({ error: "Token refresh failed" });
  }
}
