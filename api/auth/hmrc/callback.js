import axios from "axios";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const { code, error, state } = req.query;

    console.log("🔁 HMRC CALLBACK HIT");

    // =========================
    // ❌ ERROR CHECK
    // =========================
    if (error || !code || !state) {
      console.error("❌ Missing code/state or error from HMRC");
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
      console.error("❌ No user_id in state");
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
    // 👤 FETCH HMRC PROFILE (SAFE)
    // =========================
    let userDetails = null;

    try {
      const profileRes = await axios.get(
        "https://test-api.service.hmrc.gov.uk/individuals/details",
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Accept: "application/vnd.hmrc.1.0+json",
          },
        }
      );

      userDetails = profileRes.data;
      console.log("✅ HMRC Profile received");

    } catch (e) {
      console.error(
        "⚠️ HMRC PROFILE FAILED:",
        e.response?.data || e.message
      );

      // ❗ Do NOT crash — fallback
      userDetails = null;
    }

    // =========================
    // 👤 UPSERT USER (FIXED)
    // =========================
    const { error: userError } = await supabase
      .from("users")
      .upsert(
        {
          id: user_id, // 🔥 IMPORTANT (matches your DB)
          full_name: userDetails?.name
            ? `${userDetails.name.firstName || ""} ${userDetails.name.lastName || ""}`.trim()
            : null,
          dob: userDetails?.dateOfBirth || null,
          address: userDetails?.address
            ? `${userDetails.address.line1 || ""} ${userDetails.address.postcode || ""}`.trim()
            : null,
          onboarding_completed: true, // 🚀 KEY FIX
        },
        { onConflict: "id" }
      );

    if (userError) {
      console.error("❌ USER UPSERT ERROR:", userError);
    } else {
      console.log("✅ User updated & onboarding completed");
    }

    // =========================
    // 🚀 REDIRECT SUCCESS
    // =========================
    return res.redirect(
      "https://ridertax.co.uk/settings?tab=hmrc&hmrc=connected"
    );

  } catch (err) {
    console.error(
      "💥 CALLBACK ERROR:",
      err.response?.data || err.message
    );

    return res.redirect(
      "https://ridertax.co.uk/settings?hmrc=error"
    );
  }
}
