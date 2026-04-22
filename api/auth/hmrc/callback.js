import axios from "axios";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: "No code provided" });
    }

    const {
      HMRC_CLIENT_ID,
      HMRC_CLIENT_SECRET,
      HMRC_REDIRECT_URI,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    } = process.env;

    // 🔴 Check envs
    if (!HMRC_CLIENT_ID || !HMRC_CLIENT_SECRET || !HMRC_REDIRECT_URI) {
      throw new Error("Missing HMRC env variables");
    }

    // 🔁 Exchange code for token
    const tokenResponse = await axios.post(
      "https://api.service.hmrc.gov.uk/oauth/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: HMRC_CLIENT_ID,
        client_secret: HMRC_CLIENT_SECRET,
        redirect_uri: HMRC_REDIRECT_URI,
        code,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const tokens = tokenResponse.data;

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    // 🧠 TEMP user_id (you will replace later)
    const user_id = "test";

    await supabase.from("hmrc_tokens").insert({
      user_id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000),
    });

    return res.status(200).json({
      success: true,
      message: "HMRC connected",
    });

  } catch (err) {
    console.error("💥 CALLBACK ERROR:", err.response?.data || err.message);

    return res.status(500).json({
      error: "callback_failed",
      details: err.response?.data || err.message,
    });
  }
}