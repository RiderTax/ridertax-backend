import { applyCors } from "../../utils/cors.js";
import { supabase } from "../../utils/supabase.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  try {
    const { code, state, user_id } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: "Missing authorization code"
      });
    }

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id"
      });
    }

    const tokenResponse = await fetch(
      process.env.HMRC_TOKEN_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },

        body: new URLSearchParams({
          grant_type: "authorization_code",

          client_id:
            process.env.HMRC_CLIENT_ID,

          client_secret:
            process.env.HMRC_CLIENT_SECRET,

          redirect_uri:
            process.env.HMRC_REDIRECT_URI,

          code
        })
      }
    );

    const tokenData =
      await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error(
        "HMRC Token Exchange Error:",
        tokenData
      );

      return res.status(400).json({
        success: false,
        error: tokenData
      });
    }

    const expiresAt = new Date(
      Date.now() +
      tokenData.expires_in * 1000
    ).toISOString();

    const { error: dbError } =
      await supabase
        .from("hmrc_tokens")
        .upsert({
          user_id,

          access_token:
            tokenData.access_token,

          refresh_token:
            tokenData.refresh_token,

          token_type:
            tokenData.token_type,

          scope:
            tokenData.scope,

          expires_at:
            expiresAt,

          updated_at:
            new Date().toISOString()
        });

    if (dbError) {
      console.error(
        "Supabase Save Error:",
        dbError
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to store HMRC tokens"
      });
    }

    return res.redirect(
      `${process.env.FRONTEND_URL}/settings?hmrc=connected`
    );

  } catch (error) {
    console.error(
      "HMRC Callback Error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "HMRC callback failed"
    });
  }
}
