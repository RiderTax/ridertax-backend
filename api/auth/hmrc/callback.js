import axios from "axios";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const { code } = req.query;

    // ❌ No code → redirect with error
    if (!code) {
      return res.redirect(
        "https://ridertax.vercel.app/settings?hmrc=error"
      );
    }

    const {
      HMRC_CLIENT_ID,
      HMRC_CLIENT_SECRET,
      HMRC_REDIRECT_URI,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    } = process.env;

    // 🔴 Validate env variables
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

    // 🔗 Supabase client
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    // ⚠️ TEMP user_id (replace later with real logged-in user)
    const user_id = "test-user";

    // 💾 Save tokens
    const { error: dbError } = await supabase.from("hmrc_tokens").insert({
      user_id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000),
    });

    if (dbError) {
      console.error("❌ Supabase error:", dbError);
      throw new Error("Database insert failed");
    }

    // ✅ SUCCESS → redirect to SETTINGS page
    return res.redirect(
      "https://ridertax.vercel.app/settings?hmrc=connected"
    );

  } catch (err) {
    console.error("💥 CALLBACK ERROR:", err.response?.data || err.message);

    // ❌ ERROR → redirect to SETTINGS page
    return res.redirect(
      "https://ridertax.vercel.app/settings?hmrc=error"
    );
  }
}
