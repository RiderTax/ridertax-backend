import axios from "axios";

import { createClient }
from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(
  req,
  res
) {

  try {

    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    const { user_id } = req.body;

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
      return res.status(404).json({
        success: false,
        error:
          "HMRC account not connected",
      });
    }

    // =========================
    // CALL HMRC API
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

    const source =
      response.data
        ?.businesses?.[0];

    if (!source) {
      return res.status(404).json({
        success: false,
        error:
          "No HMRC business found",
      });
    }

    // IMPORTANT
    const incomeSourceId =
      source.incomeSourceId;

    console.log(
      "REAL HMRC BUSINESS ID:",
      incomeSourceId
    );

    await supabase
      .from("hmrc_profiles")
      .upsert({
        user_id,

        hmrc_business_id:
          incomeSourceId,
      });

    return res.status(200).json({
      success: true,

      hmrc_business_id:
        incomeSourceId,

      source,
    });

  } catch (err) {

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
        err.message,
    });
  }
}
