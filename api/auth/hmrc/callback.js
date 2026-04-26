import axios from "axios";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const { code, error, state } = req.query;

    console.log("🔁 HMRC CALLBACK HIT");
    console.log("Query:", req.query);

    // =========================
    // ❌ HANDLE ERRORS
    // =========================
    if (error) {
      console.error("❌ HMRC returned error:", error);
      return res.redirect("https://ridertax.co.uk/settings?hmrc=error");
    }

    if (!code) {
      console.error("❌ Missing authorization code");
      return res.redirect("https://ridertax.co.uk/settings?hmrc=error");
    }

    if (!state || typeof state !== "string") {
      console.error("❌ Missing or invalid state (user_id):", state);
      return res.redirect("https://ridertax.co.uk/settings?hmrc=error");
    }

    // ✅ THIS IS YOUR REAL USER ID
    const user_id = state.trim();

    console.log("✅ Using user_id:", user_id);

    // =========================
    // 🔐 ENV VARIABLES
    // =========================
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

    // =========================
    // 🔁 EXCHANGE CODE FOR TOKEN
    // =========================
    console.log("🔁 Exchanging code for token...");

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

    console.log("✅ Token received:", {
      access_token: tokens.access_token?.slice(0, 10),
      expires_in: tokens.expires_in,
    });

    // =========================
    // 🗄️ STORE IN SUPABASE
    // =========================
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    const { error: dbError } = await supabase
      .from("hmrc_tokens")
      .upsert(
        {
          user_id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_type: tokens.token_type,
          scope: tokens.scope || null,
          expires_at: expiresAt,
        },
        {
          onConflict: "user_id",
        }
      );

    if (dbError) {
      console.error("❌ Supabase error:", dbError);
      return res.redirect("https://ridertax.co.uk/settings?hmrc=error");
    }

    console.log("✅ Token stored successfully for user:", user_id);

    // =========================
    // 🚀 SUCCESS REDIRECT
    // =========================
    return res.redirect(
      "https://ridertax.co.uk/settings?hmrc=connected"
    );

  } catch (err) {
    console.error("💥 CALLBACK CRASH:", err.response?.data || err.message);

    return res.redirect(
      "https://ridertax.co.uk/settings?hmrc=error"
    );
  }
}
