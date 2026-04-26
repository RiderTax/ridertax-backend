import { createClient } from "@supabase/supabase-js";
import { buildFraudHeaders } from "../../hmrc/fraudHeaders";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    // ✅ STEP 1: Get stored token (IMPORTANT)
    const { data: token, error } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (error || !token) {
      return res.status(401).json({ error: "No HMRC token found" });
    }

    const accessToken = token.access_token;

    // ✅ STEP 2: Build fraud headers
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      ...buildFraudHeaders(req, user_id),
    };

    // ✅ STEP 3: Call HMRC validator
    const response = await fetch(
      "https://test-api.service.hmrc.gov.uk/test/fraud-prevention-headers/validate",
      {
        method: "GET",
        headers,
      }
    );

    const data = await response.json();

    return res.status(200).json({
      success: true,
      data,
    });

  } catch (err) {
    console.error("HMRC ERROR:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
}
