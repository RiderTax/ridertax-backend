import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { code, state, user_id } = req.query;

    // =========================
    // VALIDATION
    // =========================
    if (!code) {
      return res.status(400).json({
        success: false,
        error: "Missing OAuth code",
      });
    }

    // =========================
    // RECOVER USER_ID FROM STATE
    // =========================
    let finalUserId = user_id;

    if (!finalUserId && state) {
      try {
        const decoded = JSON.parse(
          Buffer.from(state, "base64").toString("utf8")
        );

        finalUserId = decoded.user_id;
      } catch (err) {
        console.error("❌ Failed to decode state:", err);
      }
    }

    if (!finalUserId) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id",
      });
    }

    console.log("✅ CALLBACK USER:", finalUserId);

    // =========================
    // TOKEN EXCHANGE
    // =========================
    const tokenResponse = await fetch(
      `${process.env.HMRC_BASE_URL}/oauth/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.HMRC_CLIENT_ID,
          client_secret: process.env.HMRC_CLIENT_SECRET,
          grant_type: "authorization_code",
          redirect_uri: process.env.HMRC_REDIRECT_URI,
          code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("❌ HMRC TOKEN ERROR:", tokenData);

      return res.status(400).json({
        success: false,
        error: tokenData,
      });
    }

    // =========================
    // SAVE TOKENS
    // =========================
    const expiresAt = new Date(
      Date.now() + tokenData.expires_in * 1000
    ).toISOString();

    const { error: saveError } = await supabase
      .from("hmrc_tokens")
      .upsert({
        user_id: finalUserId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type,
        scope: tokenData.scope,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      });

    if (saveError) {
      console.error("❌ SUPABASE SAVE ERROR:", saveError);

      return res.status(500).json({
        success: false,
        error: saveError.message,
      });
    }

    console.log("✅ HMRC TOKENS SAVED");

    // =========================
    // REDIRECT BACK TO APP
    // =========================
    return res.redirect(
      `https://ridertax.co.uk/Dashboard?hmrc=connected`
    );

  } catch (err) {
    console.error("💥 CALLBACK ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
