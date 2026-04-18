import axios from "axios";

export default async function handler(req, res) {
  try {
    const fraudHeaders = {
      "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
      "Gov-Client-User-Agent": req.headers["user-agent"] || "Postman",
      "Gov-Client-Public-IP":
        req.headers["x-forwarded-for"]?.split(",")[0] || "127.0.0.1",
      "Gov-Client-Timezone": "UTC",
      "Gov-Vendor-Product-Name": "RiderTax",
      "Gov-Vendor-Version": "1.0.0",

      // ✅ VERY IMPORTANT (YOU WERE MISSING THIS)
      "Accept": "application/vnd.hmrc.1.0+json",
      "Content-Type": "application/json"
    };

    const response = await axios.post(
      `${process.env.HMRC_BASE_URL}/test/fraud-prevention-headers/validate`,
      {},
      { headers: fraudHeaders }
    );

    return res.status(200).json({
      success: true,
      hmrc_response: response.data
    });

  } catch (err) {
    console.error("HMRC ERROR:", err.response?.data || err.message);

    return res.status(400).json({
      success: false,
      error: err.response?.data || err.message
    });
  }
}