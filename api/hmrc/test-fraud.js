import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { buildFraudHeaders } from "../../utils/hmrcFraudHeaders";

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

    // ✅ Get token from DB
    const { data } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!data) {
      return res.status(400).json({
        error: "User not connected to HMRC",
        user_id
      });
    }

    const access_token = data.access_token;

    // ✅ Build headers
    const headers = {
      Authorization: `Bearer ${access_token}`,
      ...buildFraudHeaders(req, user_id),
    };

    // ✅ HMRC validation endpoint
    const response = await axios.get(
      "https://test-api.service.hmrc.gov.uk/test/fraud-prevention-headers/validate",
      { headers }
    );

    return res.status(200).json(response.data);

  } catch (err) {
    console.error("❌ Fraud test error:", err.response?.data || err.message);

    return res.status(500).json({
      error: err.response?.data || err.message,
    });
  }
}
