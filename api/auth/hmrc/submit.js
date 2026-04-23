import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const userId = req.query.user_id;

    // 1️⃣ GET TOKEN FROM DB
    const { data: token, error } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !token) {
      return res.status(401).json({ error: "No HMRC token found" });
    }

    let accessToken = token.access_token;

    // 2️⃣ CHECK EXPIRY
    const now = new Date();
    const expiry = new Date(token.expires_at);

    const isExpired = now >= expiry;

    // 3️⃣ REFRESH IF EXPIRED
    if (isExpired) {
      const refreshResponse = await fetch(
        "https://test-api.service.hmrc.gov.uk/oauth/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: token.refresh_token,
            client_id: process.env.HMRC_CLIENT_ID,
            client_secret: process.env.HMRC_CLIENT_SECRET,
          }),
        }
      );

      const newTokens = await refreshResponse.json();

      if (!refreshResponse.ok) {
        return res.status(401).json({ error: "Token refresh failed" });
      }

      // SAVE NEW TOKENS
      await supabase
        .from("hmrc_tokens")
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at: new Date(Date.now() + newTokens.expires_in * 1000),
        })
        .eq("user_id", userId);

      accessToken = newTokens.access_token;
    }

    // 4️⃣ CALL HMRC (THIS IS YOUR PROOF CALL)
    const hmrcResponse = await fetch(
      "https://test-api.service.hmrc.gov.uk/individuals/self-assessment/obligations?from=2024-04-06&to=2025-04-05",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.hmrc.1.0+json",
        },
      }
    );

    const data = await hmrcResponse.json();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
    });
  }
}
