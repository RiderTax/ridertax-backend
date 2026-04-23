import { createClient } from "@supabase/supabase-js";
import { buildFraudHeaders } from "../hmrc/fraudHeaders"; // ✅ make sure path is correct

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const userId = req.query.user_id;

    if (!userId) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    // 1️⃣ GET TOKEN FROM DB
    let { data: token, error } = await supabase
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
      console.log("Token expired → refreshing...");

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
        return res.status(401).json({
          error: "Token refresh failed",
          details: newTokens,
        });
      }

      const newExpiry = new Date(
        Date.now() + newTokens.expires_in * 1000
      ).toISOString();

      // 💾 SAVE NEW TOKENS
      await supabase
        .from("hmrc_tokens")
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at: newExpiry,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      accessToken = newTokens.access_token;
    }

    // 4️⃣ BUILD FRAUD HEADERS (🚨 CRITICAL FIX)
    const fraudHeaders = buildFraudHeaders(req, userId);

    // 5️⃣ CALL HMRC API
    const hmrcResponse = await fetch(
      "https://test-api.service.hmrc.gov.uk/individuals/self-assessment/obligations?from=2024-04-06&to=2025-04-05",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.hmrc.1.0+json",
          ...fraudHeaders, // ✅ THIS FIXES YOUR 401
        },
      }
    );

    const data = await hmrcResponse.json();

    if (!hmrcResponse.ok) {
      return res.status(hmrcResponse.status).json({
        error: "HMRC request failed",
        details: data,
      });
    }

    // ✅ SUCCESS
    return res.status(200).json({
      success: true,
      data,
    });

  } catch (err) {
    console.error("Submit error:", err);
    return res.status(500).json({
      error: err.message,
    });
  }
}
