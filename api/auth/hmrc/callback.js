import axios from "axios";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const { code, error, state } = req.query;

    // ❌ If HMRC returned error
    if (error) {
      return res.redirect("https://ridertax.co.uk/settings?hmrc=error");
    }

    // ❌ If no code
    if (!code) {
      return res.redirect("https://ridertax.co.uk/settings?hmrc=error");
    }

    // ❌ If no state (user_id)
    if (!state || typeof state !== "string") {
      console.error("❌ Missing or invalid state:", state);
      return res.redirect("https://ridertax.co.uk/settings?hmrc=error");
    }

    const user_id = state;

    const {
      HMRC_CLIENT_ID,
      HMRC_CLIENT_SECRET,
      HMRC_REDIRECT_URI,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    } = process.env;

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

    console.log("✅ Token received for user:", user_id);

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    // ✅ UPSERT (insert or update tokens per user)
    const { error: dbError } = await supabase
      .from("hmrc_tokens")
      .upsert(
        {
          user_id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_type: tokens.token_type,
          scope: tokens.scope || null,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000),
        },
        {
          onConflict: "user_id",
        }
      );

    if (dbError) {
      console.error("❌ Supabase upsert error:", dbError);
    }

    // ✅ SUCCESS → redirect back to app
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
