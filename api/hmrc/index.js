export const config = {
  runtime: "nodejs",
};

import axios from "axios";
import { createClient } from "@supabase/supabase-js";

// ✅ Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const path = req.url || "";

  // ===============================
  // ✅ ROOT
  // ===============================
  if (path === "/api/hmrc" || path === "/api/hmrc/") {
    return res.send("HMRC API Root Working ✅");
  }

  // ===============================
  // 🛡️ VALIDATE HEADERS
  // ===============================
  if (path.endsWith("/validate-headers")) {
    try {
      const fraudHeaders = {
        "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
        "Gov-Client-User-Agent": req.headers["user-agent"] || "unknown",
        "Gov-Client-Public-IP":
          req.headers["x-forwarded-for"]?.split(",")[0] || "127.0.0.1",
        "Gov-Client-Timezone": "UTC",
        "Gov-Vendor-Product-Name": "RiderTax",
        "Gov-Vendor-Version": "1.0.0",
      };

      const response = await axios.post(
        `${process.env.HMRC_BASE_URL}/test/fraud-prevention-headers/validate`,
        {},
        { headers: fraudHeaders }
      );

      return res.status(200).json({
        success: true,
        hmrc_response: response.data,
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: err.response?.data || err.message,
      });
    }
  }

  // ===============================
  // 🔐 CALLBACK
  // ===============================
  if (path.includes("/auth/hmrc/callback")) {
    const { code, state } = req.query;

    if (!state) {
      return res.status(400).send("Missing user context");
    }

    try {
      const response = await axios.post(
        `${process.env.HMRC_BASE_URL}/oauth/token`,
        new URLSearchParams({
          grant_type: "authorization_code",
          client_id: process.env.HMRC_CLIENT_ID,
          client_secret: process.env.HMRC_CLIENT_SECRET,
          redirect_uri: process.env.HMRC_REDIRECT_URI,
          code,
        }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      const token = response.data;

      await supabase.from("hmrc_tokens").upsert({
        user_id: state,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: new Date(Date.now() + token.expires_in * 1000),
        scope: token.scope,
        token_type: token.token_type,
      });

      return res.send("HMRC connected successfully ✅");
    } catch (err) {
      return res.status(500).send("HMRC connection failed");
    }
  }

  // ===============================
  // 🔄 REFRESH
  // ===============================
  if (path.includes("/refresh")) {
    const userId = path.split("/").pop();

    const { data } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!data) return res.status(404).send("User not found");

    try {
      const response = await axios.post(
        `${process.env.HMRC_BASE_URL}/oauth/token`,
        new URLSearchParams({
          grant_type: "refresh_token",
          client_id: process.env.HMRC_CLIENT_ID,
          client_secret: process.env.HMRC_CLIENT_SECRET,
          refresh_token: data.refresh_token,
        }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      const token = response.data;

      await supabase.from("hmrc_tokens").upsert({
        user_id: userId,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: new Date(Date.now() + token.expires_in * 1000),
        scope: token.scope,
        token_type: token.token_type,
      });

      return res.send("Token refreshed ✅");
    } catch (err) {
      return res.status(500).send("Refresh failed");
    }
  }

  // ===============================
  // ❌ FALLBACK
  // ===============================
  return res.status(404).send("Route not found");
}