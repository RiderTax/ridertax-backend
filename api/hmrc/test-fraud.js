import axios from "axios";
import { buildFraudHeaders } from "../../utils/hmrcFraudHeaders";

export default async function handler(req, res) {
  try {
    const { user_id } = req.query;

    // 🔐 STEP 1: Get access token (NO SCOPE)
    const tokenRes = await axios.post(
      "https://test-api.service.hmrc.gov.uk/oauth/token",
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.HMRC_CLIENT_ID,
        client_secret: process.env.HMRC_CLIENT_SECRET,
        scope: "" // ✅ IMPORTANT FIX
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      }
    );

    const accessToken = tokenRes.data.access_token;

    // 🔐 STEP 2: Build fraud headers
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      ...buildFraudHeaders(req, user_id),
    };

    // 🚀 STEP 3: Call HMRC validator
    const response = await axios.get(
      "https://test-api.service.hmrc.gov.uk/test/fraud-prevention-headers/validate",
      {
        headers,
        validateStatus: () => true // so we see full response
      }
    );

    return res.status(200).json(response.data);

  } catch (err) {
    console.error("HMRC ERROR:", err.response?.data || err.message);

    return res.status(500).json({
      error: err.response?.data || err.message
    });
  }
}
