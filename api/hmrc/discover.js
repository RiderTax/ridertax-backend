import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function applyCors(res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  res.setHeader(
    "Access-Control-Max-Age",
    "86400"
  );
}

export default async function handler(
  req,
  res
) {

  // =========================
  // ALWAYS APPLY CORS
  // =========================
  applyCors(res);

  // =========================
  // HANDLE PREFLIGHT
  // =========================
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

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
    // SAFE BODY PARSE
    // =========================
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

    console.log(
      "DISCOVER BODY:",
      JSON.stringify(body, null, 2)
    );

    const { user_id } = body || {};

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id",
      });
    }

    // =========================
    // GET HMRC TOKEN
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

    console.log("TOKEN FOUND");

    // =========================
    // HMRC API CALL
    // =========================
    const hmrcResponse =
      await axios.get(
        `${process.env.HMRC_BASE_URL}/income-tax-mtd/income-sources`,
        {
          headers: {
            Authorization:
              `Bearer ${tokenRow.access_token}`,

            Accept:
              "application/vnd.hmrc.1.0+json",
          },

          timeout: 30000,
        }
      );

    console.log(
      "FULL HMRC RESPONSE:"
    );

    console.log(
      JSON.stringify(
        hmrcResponse.data,
        null,
        2
      )
    );

    // =========================
    // SUPPORT MULTIPLE FORMATS
    // =========================
    const source =
      hmrcResponse.data
        ?.selfEmployment?.[0] ||

      hmrcResponse.data
        ?.businesses?.[0] ||

      hmrcResponse.data
        ?.incomeSources?.[0] ||

      hmrcResponse.data
        ?.properties?.[0];

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
          hmrcResponse.data,
      });
    }

    // =========================
    // FLEXIBLE ID EXTRACTION
    // =========================
    const incomeSourceId =
      source.incomeSourceId ||
      source.id ||
      source.incomeSource ||
      source.businessId ||
      source.sourceId;

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
      source.tradingName ||
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
