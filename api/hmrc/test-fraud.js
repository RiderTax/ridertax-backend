import axios from "axios";
import { buildFraudHeaders } from "../../utils/hmrcFraudHeaders";

export default async function handler(req, res) {
  try {
    const user_id = req.query.user_id || "test-user";

    const headers = buildFraudHeaders(req, user_id);

    const response = await axios.get(
      "https://test-api.service.hmrc.gov.uk/test/fraud-prevention-headers/validate",
      { headers }
    );

    return res.status(200).json(response.data);
  } catch (err) {
    console.error(err.response?.data || err.message);

    return res.status(500).json({
      error: err.response?.data || err.message,
    });
  }
}
