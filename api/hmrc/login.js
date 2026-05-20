import crypto from "crypto";
import { applyCors } from "../../utils/cors.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  try {
    const state = crypto.randomBytes(16).toString("hex");

    const params = new URLSearchParams({
      response_type: "code",

      client_id: process.env.HMRC_CLIENT_ID,

      redirect_uri:
        process.env.HMRC_REDIRECT_URI,

      scope:
        "read:self-assessment write:self-assessment",

      state,
    });

    const authUrl =
      `${process.env.HMRC_AUTH_URL}?${params.toString()}`;

    return res.status(200).json({
      success: true,
      auth_url: authUrl,
      state,
    });

  } catch (error) {
    console.error("HMRC Login Error:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to generate HMRC login URL",
    });
  }
}
