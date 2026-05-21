import axios from "axios";
import { createClient } from "@supabase/supabase-js";

import { applyCors } from "../../utils/cors.js";
import { buildFraudHeaders } from "../../utils/fraudHeaders.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  try {
    // =========================
    // ✅ ONLY POST
    // =========================
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    // =========================
    // ✅ REQUEST BODY
    // =========================
    const {
      user_id,
      nino,
      business_id,
      tax_year,
      period_start,
      period_end,
      income,
      expenses,
    } = req.body || {};

    // =========================
    // ✅ BASIC VALIDATION
    // =========================
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id",
      });
    }

    if (!nino) {
      return res.status(400).json({
        success: false,
        error: "Missing nino",
      });
    }

    console.log(
      "📤 HMRC SUBMIT START:",
      user_id
    );

    // =========================
    // ✅ GET HMRC TOKENS
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
        "❌ TOKEN ERROR:",
        tokenError
      );

      return res.status(401).json({
        success: false,
        error:
          "No HMRC connection found",
      });
    }

    // =========================
    // ✅ BUILD FRAUD HEADERS
    // =========================
    const fraudHeaders =
      buildFraudHeaders(req);

    // =========================
    // ✅ HMRC PAYLOAD
    // =========================
    const hmrcPayload = {
      periodStartDate:
        period_start,

      periodEndDate:
        period_end,

      financials: {
        turnover:
          Number(income || 0),

        consolidatedExpenses:
          Number(expenses || 0),
      },
    };

    console.log(
      "📦 HMRC PAYLOAD:",
      hmrcPayload
    );

    // =========================
    // ✅ HMRC SUBMISSION
    // =========================
    const hmrcUrl =
      `${process.env.HMRC_BASE_URL}` +
      `/individuals/business/income-source` +
      `/${nino}` +
      `/self-employment` +
      `/${business_id}` +
      `/periodic-summaries`;

    const hmrcResponse =
      await axios.post(
        hmrcUrl,
        hmrcPayload,
        {
          headers: {
            Authorization:
              `Bearer ${tokenRow.access_token}`,

            Accept:
              "application/vnd.hmrc.1.0+json",

            "Content-Type":
              "application/json",

            ...fraudHeaders,
          },
        }
      );

    // =========================
    // ✅ RESPONSE DATA
    // =========================
    const correlationId =
      hmrcResponse.headers[
        "x-correlationid"
      ] ||
      hmrcResponse.headers[
        "X-CorrelationId"
      ] ||
      null;

    const responseData =
      hmrcResponse.data;

    console.log(
      "✅ HMRC SUBMISSION SUCCESS"
    );

    // =========================
    // ✅ AUDIT LOG
    // =========================
    await supabase
      .from("hmrc_logs")
      .insert({
        user_id,

        action:
          "submit_periodic_summary",

        endpoint: hmrcUrl,

        status:
          hmrcResponse.status.toString(),

        correlation_id:
          correlationId,

        request_payload:
          hmrcPayload,

        response_payload:
          responseData,

        created_at:
          new Date().toISOString(),
      });

    // =========================
    // ✅ SUCCESS RESPONSE
    // =========================
    return res.status(200).json({
      success: true,

      submitted: true,

      correlation_id:
        correlationId,

      hmrc_response:
        responseData,
    });

  } catch (err) {
    console.error(
      "💥 HMRC SUBMIT ERROR:",
      err?.response?.data ||
      err.message
    );

    // =========================
    // ✅ SAFE ERROR PARSING
    // =========================
    let errorData =
      err?.response?.data ||
      err.message ||
      "Submission failed";

    // =========================
    // ✅ AUDIT FAILURE LOG
    // =========================
    try {
      const { user_id } =
        req.body || {};

      await supabase
        .from("hmrc_logs")
        .insert({
          user_id,

          action:
            "submit_periodic_summary",

          status: "failed",

          response_payload:
            errorData,

          created_at:
            new Date().toISOString(),
        });

    } catch (logErr) {
      console.error(
        "❌ AUDIT LOG ERROR:",
        logErr
      );
    }

    // =========================
    // ✅ ERROR RESPONSE
    // =========================
    return res.status(500).json({
      success: false,
      error: errorData,
    });
  }
}
