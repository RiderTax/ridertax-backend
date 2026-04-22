import axios from "axios";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const { code, error } = req.query;

    // ❌ If HMRC returned error
    if (error) {
      return res.redirect("https://ridertax.co.uk/settings?hmrc=error");
    }

    // ❌ If no code
    if (!code) {
      return res.redirect("https://ridertax.co.uk/settings?hmrc=error");
    }

    const {
      HMRC_CLIENT_ID,
      HMRC_CLIENT_SECRET,
      HMRC_REDIRECT_URI,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    } = process.env;

    // 🔴 Validate envs
    if (!HMRC_CLIENT_ID || !HMRC_CLIENT_SECRET || !HMRC_REDIRECT_URI) {
      throw new Error("Missing HMRC env variables");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase env variables");
    }

    console.log("🔁 Exchanging code for token...");

    // ✅ HMRC SANDBOX TOKEN ENDPOINT
    const tokenResponse = await axios.post(
      "https://test-api.service.hmrc.gov.uk/oauth/token",
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

    console.log("✅ Token received");

    // 🔗 Supabase
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    // ⚠️ TEMP user_id (replace later with real user)
    const user_id = "test-user";

    // ✅ FIXED INSERT (matches your table)
    const { error: dbError } = await supabase.from("hmrc_tokens").insert({
      user_id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });

    // 🚨 Do NOT break flow if DB fails
    if (dbError) {
      console.error("❌ Supabase insert error:", dbError);
    }

    // ✅ SUCCESS → redirect to settings
    return res.redirect(
      "https://ridertax.co.uk/settings?hmrc=connected"
    );

  } catch (err) {
    console.error("💥 CALLBACK ERROR:", err.response?.data || err.message);

    return res.redirect(
      "https://ridertax.co.uk/settings?hmrc=error"
    );
  }
}
