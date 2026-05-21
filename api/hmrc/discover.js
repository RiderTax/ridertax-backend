import axios from "axios";

import { createClient }
from "@supabase/supabase-js";

import { applyCors }
from "../../utils/cors.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(
  req,
  res
) {

  // =========================
  // CORS
  // =========================
  if (applyCors(req, res)) return;

  try {

    // =========================
    // METHOD CHECK
    // =========================
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    // =========================
    // BODY
    // =========================
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

    console.log(
      "DISCOVER BODY:",
      JSON.stringify(body, null, 2)
    );

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

      console.error(
        "TOKEN ERROR:",
        tokenError
      );

      return res.status(404).json({
        success: false,
        error:
          "HMRC account not connected",
      });
    }

    console.log(
      "TOKEN FOUND"
    );

    // =========================
    // HMRC API CALL
    // =========================
    const response =
      await axios.get(
        `${process.env.HMRC_BASE_URL}/income-tax-mtd/income-sources`,
        {
          headers: {
            Authorization:
              `Bearer ${tokenRow.access_token}`,

            Accept:
              "application/vnd.hmrc.1.0+json",
          },
        }
      );

    // =========================
    // DEBUG FULL RESPONSE
    // =========================
    console.log(
      "FULL HMRC RESPONSE:"
    );

    console.log(
      JSON.stringify(
        response.data,
        null,
        2
      )
    );

    // =========================
    // SUPPORT MULTIPLE HMRC FORMATS
    // =========================
    const source =
      response.data
        ?.selfEmployment?.[0] ||

      response.data
        ?.businesses?.[0] ||

      response.data
        ?.incomeSources?.[0];

    console.log(
      "SELECTED SOURCE:"
    );

    console.log(
      JSON.stringify(
        source,
        null,
        2
      )
    );

    if (!source) {

      return res.status(404).json({
        success: false,
        error:
          "No HMRC business found",
        hmrc_response:
          response.data,
      });
    }

    // =========================
    // FLEXIBLE ID SUPPORT
    // =========================
    const incomeSourceId =
      source.incomeSourceId ||
      source.id ||
      source.incomeSource ||
      source.businessId;

    console.log(
      "REAL HMRC BUSINESS ID:",
      incomeSourceId
    );

    if (!incomeSourceId) {

      return res.status(400).json({
        success: false,
        error:
          "incomeSourceId missing",
        source,
      });
    }

    // =========================
    // BUSINESS NAME
    // =========================
    const businessName =
      source.businessName ||
      source.name ||
      "HMRC Business";

    // =========================
    // SAVE TO SUPABASE
    // =========================
    const {
      error: saveError,
    } = await supabase
      .from("hmrc_profiles")
      .upsert({
        user_id,

        hmrc_business_id:
          incomeSourceId,
      });

    if (saveError) {

      console.error(
        "SAVE ERROR:",
        saveError
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to save HMRC profile",
        saveError,
      });
    }

    console.log(
      "PROFILE SAVED"
    );

    // =========================
    // SUCCESS
    // =========================
    return res.status(200).json({
      success: true,

      hmrc_business_id:
        incomeSourceId,

      source: {
        ...source,
        businessName,
      },
    });

  } catch (err) {

    console.error(
      "DISCOVERY ERROR:"
    );

    console.error(
      err?.response?.data ||
      err.message
    );

    return res.status(
      err?.response?.status || 500
    ).json({
      success: false,

      error:
        err?.response?.data ||
        err.message ||
        "Discovery failed",
    });
  }
}
