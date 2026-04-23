import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken"; // for decoding Supabase auth

export default async function handler(req, res) {
  try {
    const { code, error, state } = req.query;

    // ❌ If HMRC returned error
    if (error) {
      return res.redirect("https://ridertax.co.uk/settings?hmrc=error");
    }

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

    if (!HMRC_CLIENT_ID || !HMRC_CLIENT_SECRET || !HMRC_REDIRECT_URI) {
      throw new Error("Missing HMRC env variables");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase env variables");
    }

    // 🔐 Get user from state (IMPORTANT)
    if (!state) {
      throw new Error("Missing state (user session)");
    }

    // You should pass Supabase JWT in state during login
    let user_id;

    try {
      const decoded = jwt.decode(state);
      user_id = decoded?.sub;
    } catch (e) {
      throw new Error("Invalid state token");
    }

    if (!user_id) {
      throw new Error("User not identified");
    }

    console.log("👤 User ID:", user_id);
    console.log("🔁 Exchanging code for token...");

    // ✅ Exchange code for token
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

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    // ✅ Save tokens
    const { error: tokenError } = await supabase
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
        { onConflict: "user_id" }
      );

    if (tokenError) {
      console.error("❌ Token save error:", tokenError);
    }

    // ✅ UPDATE USER STATUS (THIS WAS MISSING 🔥)
    const { error: userError } = await supabase
      .from("users")
      .update({ hmrc_connected: true })
      .eq("id", user_id);

    if (userError) {
      console.error("❌ User update error:", userError);
    }

    // ✅ SUCCESS REDIRECT
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
