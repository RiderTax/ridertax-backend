import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { buildFraudHeaders } from "../../hmrc/fraudHeaders";

export default async function handler(req, res) {
  try {
    const { code, error, state } = req.query;

    console.log("🔁 HMRC CALLBACK HIT");

    if (error || !code || !state) {
      return res.redirect("https://ridertax.co.uk/settings?hmrc=error");
    }

    // =========================
    // 🔐 DECODE STATE
    // =========================
    let decoded;
    try {
      decoded = JSON.parse(
        Buffer.from(state, "base64").toString("utf-8")
      );
    } catch (e) {
      console.error("❌ State decode failed:", e);
      return res.redirect("https://ridertax.co.uk/settings?hmrc=error");
    }

    const { user_id } = decoded;

    if (!user_id) {
      return res.redirect("https://ridertax.co.uk/settings?hmrc=error");
    }

    // =========================
    // 🔐 ENV
    // =========================
    const {
      HMRC_CLIENT_ID,
      HMRC_CLIENT_SECRET,
      HMRC_REDIRECT_URI,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    } = process.env;

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    // =========================
    // 🔁 TOKEN EXCHANGE
    // =========================
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

    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    // =========================
    // 💾 STORE TOKEN
    // =========================
    await supabase.from("hmrc_tokens").upsert(
      {
        user_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type,
        scope: tokens.scope || null,
        expires_at: expiresAt,
      },
      { onConflict: "user_id" }
    );

    console.log("✅ Token stored");

    // =========================
    // 👤 FETCH HMRC PROFILE
    // =========================
    let userDetails = null;

    try {
      const fraudHeaders = buildFraudHeaders(req, user_id);

      const profileRes = await axios.get(
        "https://test-api.service.hmrc.gov.uk/individuals/details",
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Accept: "application/vnd.hmrc.1.0+json",
            ...fraudHeaders,
          },
        }
      );

      userDetails = profileRes.data;
      console.log("✅ HMRC Profile received:", userDetails);

    } catch (e) {
      console.error(
        "❌ HMRC PROFILE ERROR:",
        e.response?.data || e.message
      );
    }

    // =========================
    // 👤 SAVE USER (FIXED)
    // =========================
    await supabase.from("users").upsert(
      {
        id: user_id, // 🔥 FIXED: must match your table PK
        full_name: userDetails?.name
          ? `${userDetails.name.firstName || ""} ${userDetails.name.lastName || ""}`.trim()
          : null,
        dob: userDetails?.dateOfBirth || null,
        address: userDetails?.address
          ? `${userDetails.address.line1 || ""} ${userDetails.address.postcode || ""}`.trim()
          : null,
        onboarding_completed: true,
      },
      { onConflict: "id" } // 🔥 FIXED
    );

    console.log("✅ User synced to DB");

    // =========================
    // 🚀 REDIRECT
    // =========================
    return res.redirect(
      "https://ridertax.co.uk/settings?tab=hmrc&hmrc=connected"
    );

  } catch (err) {
    console.error("💥 CALLBACK ERROR:", err.response?.data || err.message);

    return res.redirect(
      "https://ridertax.co.uk/settings?hmrc=error"
    );
  }
}
