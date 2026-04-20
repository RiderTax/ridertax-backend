import axios from "axios";
import { createClient } from "@supabase/supabase-js";

// ✅ Validate ENV variables (prevents silent crashes)
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

if (!process.env.HMRC_CLIENT_ID || !process.env.HMRC_CLIENT_SECRET || !process.env.HMRC_REDIRECT_URI) {
  throw new Error("Missing HMRC environment variables");
}

// ✅ Initialize Supabase correctly
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  const { code, state } = req.query;

  try {
    console.log("✅ HMRC CALLBACK HIT");
    console.log("CODE:", code);
    console.log("STATE:", state);

    // ❌ No code received
    if (!code) {
      console.error("❌ No code received from HMRC");
      return res.redirect("https://rider-tax-flow.base44.app/settings?hmrc=failed");
    }

    // 🔐 Exchange authorization code for tokens
    const response = await axios.post(
      "https://test-api.service.hmrc.gov.uk/oauth/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.HMRC_CLIENT_ID,
        client_secret: process.env.HMRC_CLIENT_SECRET,
        redirect_uri: process.env.HMRC_REDIRECT_URI,
        code: code,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
      }
    );

    const data = response.data;

    console.log("✅ TOKEN RESPONSE RECEIVED");

    // 💾 Store tokens in Supabase
    const { error: dbError } = await supabase
      .from("hmrc_tokens")
      .upsert({
        user_id: state,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000),
        scope: data.scope,
        token_type: data.token_type,
      });

    if (dbError) {
      console.error("❌ Supabase error:", dbError);
      return res.redirect("https://rider-tax-flow.base44.app/settings?hmrc=failed");
    }

    console.log("🎉 HMRC CONNECT SUCCESS");

    // ✅ Redirect back to app (success)
    return res.redirect("https://rider-tax-flow.base44.app/settings?hmrc=connected");

  } catch (error) {
    console.error("❌ HMRC CALLBACK ERROR:");
    console.error(error.response?.data || error.message);

    return res.redirect("https://rider-tax-flow.base44.app/settings?hmrc=failed");
  }
}
