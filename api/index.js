import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const url = req.url;

  // ✅ Root test
  if (url === "/" || url === "") {
    return res.status(200).send("Backend running ✅");
  }

  // ✅ HMRC callback
  if (url.startsWith("/auth/hmrc/callback")) {
    const code = req.query.code;

    try {
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
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      const data = response.data;

      await supabase.from("hmrc_tokens").upsert({
        user_id: "11111111-1111-1111-1111-111111111111",
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000),
        scope: data.scope,
        token_type: data.token_type,
      });

      return res.status(200).send("HMRC connected successfully ✅");
    } catch (error) {
      console.error(error.response?.data || error.message);
      return res.status(500).send("Error connecting to HMRC");
    }
  }

  return res.status(404).send("Not Found");
}
