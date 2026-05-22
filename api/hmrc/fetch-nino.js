import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { applyCors } from "../../utils/cors.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  if (applyCors(req, res)) return;

  try {

    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

    const { user_id } = body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id",
      });
    }

    // =========================
    // GET TOKEN
    // =========================

    const {
      data: tokenRow,
      error: tokenError,
    } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return res.status(404).json({
        success: false,
        error: "Token not found",
      });
    }

    console.log("TOKEN FOUND");

    // =========================
    // HMRC INDIVIDUAL DETAILS
    // =========================

    const response = await axios.get(
      `${process.env.HMRC_BASE_URL}/individuals/details`,
      {
        headers: {
          Authorization:
            `Bearer ${tokenRow.access_token}`,
          Accept:
            "application/vnd.hmrc.1.0+json",
        },
      }
    );

    console.log(
      "HMRC INDIVIDUAL DETAILS:",
      JSON.stringify(response.data, null, 2)
    );

    const nino =
      response.data?.nino ||
      response.data?.individual?.nino;

    if (!nino) {
      return res.status(400).json({
        success: false,
        error: "NINO not returned by HMRC",
        hmrc_response: response.data,
      });
    }

    // =========================
    // SAVE NINO
    // =========================

    const {
      error: updateError,
    } = await supabase
      .from("hmrc_tokens")
      .update({ nino })
      .eq("user_id", user_id);

    if (updateError) {
      return res.status(500).json({
        success: false,
        error: "Failed to save NINO",
        details: updateError,
      });
    }

    console.log("NINO SAVED:", nino);

    return res.status(200).json({
      success: true,
      nino,
    });

  } catch (err) {

    console.error(
      "FETCH NINO ERROR:",
      err?.response?.data || err.message
    );

    return res.status(
      err?.response?.status || 500
    ).json({
      success: false,
      error:
        err?.response?.data ||
        err.message,
    });
  }
}
