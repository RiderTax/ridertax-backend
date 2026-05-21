import axios from "axios";
import crypto from "crypto";

import { createClient } from "@supabase/supabase-js";

import { applyCors } from "../../utils/cors.js";
import { buildFraudHeaders } from "../../utils/hmrcFraudHeaders.js";
import { logHmrcEvent } from "../../utils/logHmrcEvent.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function formatMoney(value) {
  return Number(
    Number(value || 0).toFixed(2)
  );
}

function buildHmrcPayload(rawPayload) {

  const income = formatMoney(
    rawPayload?.income ||
    rawPayload?.turnover ||
    0
  );

  const expenses = formatMoney(
    rawPayload?.expenses ||
    rawPayload?.consolidatedExpenses ||
    0
  );

  const periodFrom =
    rawPayload?.periodFrom ||
    "2026-04-06";

  const periodTo =
    rawPayload?.periodTo ||
    "2026-07-05";

  return {
    periodDates: {
      from: periodFrom,
      to: periodTo,
    },

    periodIncome: {
      turnover: income,
    },

    periodExpenses: {
      consolidatedExpenses:
        expenses,
    },
  };
}

export default async function handler(
  req,
  res
) {

  if (applyCors(req, res)) return;

  try {

    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    console.log(
      "📦 RAW BODY:",
      JSON.stringify(req.body, null, 2)
    );

    // =====================================
    // SAFE BODY PARSE
    // =====================================
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

    // =====================================
    // SUPPORT BOTH OLD + NEW STRUCTURE
    // =====================================
    const {
      user_id,
      tax_year,
      hmrc_business_id,
      payload,
      income,
      expenses,
      turnover,
      consolidatedExpenses,
      periodFrom,
      periodTo,
    } = body;

    // =====================================
    // AUTO BUILD PAYLOAD IF FRONTEND
    // SENDS DIRECT VALUES
    // =====================================
    const effectivePayload =
      payload || {
        income,
        expenses,
        turnover,
        consolidatedExpenses,
        periodFrom,
        periodTo,
      };

    console.log(
      "📨 EFFECTIVE PAYLOAD:",
      JSON.stringify(
        effectivePayload,
        null,
        2
      )
    );

    // =========================
    // VALIDATION
    // =========================
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id",
      });
    }

    if (!tax_year) {
      return res.status(400).json({
        success: false,
        error: "Missing tax_year",
      });
    }

    if (!effectivePayload) {
      return res.status(400).json({
        success: false,
        error: "Missing payload",
      });
    }

    // =========================
    // FETCH HMRC PROFILE
    // =========================
    let effectiveBusinessId =
      hmrc_business_id;

    if (!effectiveBusinessId) {

      const {
        data: hmrcProfile,
      } = await supabase
        .from("hmrc_profiles")
        .select("*")
        .eq("user_id", user_id)
        .maybeSingle();

      effectiveBusinessId =
        hmrcProfile?.hmrc_business_id;
    }

    if (!effectiveBusinessId) {

      console.error(
        "❌ NO HMRC BUSINESS ID"
      );

      return res.status(400).json({
        success: false,
        error:
          "Missing HMRC self-employment source",
      });
    }

    console.log(
      "✅ USING HMRC BUSINESS ID:",
      effectiveBusinessId
    );

    // =========================
    // GET TOKENS
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

      return res.status(404).json({
        success: false,
        error:
          "HMRC account not connected",
      });
    }

    let accessToken =
      tokenRow.access_token;

    // =========================
    // REFRESH TOKEN
    // =========================
    const expiry =
      new Date(
        tokenRow.expires_at
      ).getTime();

    const now =
      Date.now();

    if (
      expiry - now <
      5 * 60 * 1000
    ) {

      console.log(
        "🔄 REFRESHING TOKEN"
      );

      const refreshResponse =
        await axios.post(
          process.env.HMRC_TOKEN_URL,

          new URLSearchParams({
            grant_type:
              "refresh_token",

            client_id:
              process.env
                .HMRC_CLIENT_ID,

            client_secret:
              process.env
                .HMRC_CLIENT_SECRET,

            refresh_token:
              tokenRow.refresh_token,
          }),

          {
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
            },
          }
        );

      accessToken =
        refreshResponse.data
          .access_token;

      await supabase
        .from("hmrc_tokens")
        .update({
          access_token:
            refreshResponse.data
              .access_token,

          refresh_token:
            refreshResponse.data
              .refresh_token,

          expires_at:
            new Date(
              Date.now() +
              refreshResponse.data
                .expires_in *
              1000
            ).toISOString(),
        })
        .eq("user_id", user_id);
    }

    // =========================
    // FRAUD HEADERS
    // =========================
    const fraudHeaders =
      buildFraudHeaders(req);

    console.log(
      "🛡️ HMRC Fraud headers generated"
    );

    // =========================
    // BUILD HMRC PAYLOAD
    // =========================
    const hmrcPayload =
      buildHmrcPayload(
        effectivePayload
      );

    console.log(
      "[HMRC] FINAL PAYLOAD:"
    );

    console.log(
      JSON.stringify(
        hmrcPayload,
        null,
        2
      )
    );

    // =========================
    // CORRELATION
    // =========================
    const correlationId =
      crypto.randomUUID();

    // =========================
    // HMRC ENDPOINT
    // =========================
    const endpoint =
      `${process.env.HMRC_BASE_URL}` +
      `/income-tax-mtd/itsa/${effectiveBusinessId}/periodic-summaries`;

    console.log(
      "[HMRC] ENDPOINT:",
      endpoint
    );

    // =========================
    // SUBMIT
    // =========================
    let hmrcResponse;

    try {

      hmrcResponse =
        await axios.post(
          endpoint,
          hmrcPayload,
          {
            timeout: 30000,

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              Accept:
                "application/vnd.hmrc.1.0+json",

              "Content-Type":
                "application/json",

              CorrelationId:
                correlationId,

              ...fraudHeaders,
            },
          }
        );

    } catch (submitErr) {

      console.error(
        "❌ HMRC SUBMIT ERROR"
      );

      console.error(
        JSON.stringify(
          submitErr?.response?.data,
          null,
          2
        )
      );

      await logHmrcEvent({
        user_id,

        endpoint,

        method: "POST",

        request_headers: {
          Authorization:
            "[REDACTED]",
          ...fraudHeaders,
        },

        request_body:
          hmrcPayload,

        response_status:
          submitErr?.response?.status ||
          500,

        response_body:
          submitErr?.response?.data ||
          {},

        correlation_id:
          correlationId,

        error_message:
          submitErr.message,
      });

      return res.status(
        submitErr?.response?.status ||
        500
      ).json({
        success: false,

        correlation_id:
          correlationId,

        hmrc_error:
          submitErr?.response?.data,

        error:
          submitErr?.response?.data
            ?.message ||
          "HMRC submission failed",
      });
    }

    // =========================
    // SUCCESS
    // =========================
    console.log(
      "✅ HMRC SUBMISSION SUCCESS"
    );

    await logHmrcEvent({
      user_id,

      endpoint,

      method: "POST",

      request_headers: {
        Authorization:
          "[REDACTED]",
        ...fraudHeaders,
      },

      request_body:
        hmrcPayload,

      response_status:
        hmrcResponse.status,

      response_body:
        hmrcResponse.data,

      correlation_id:
        correlationId,
    });

    return res.status(200).json({
      success: true,

      correlation_id:
        correlationId,

      hmrc_response:
        hmrcResponse.data,
    });

  } catch (err) {

    console.error(
      "💥 SUBMIT CRASH:"
    );

    console.error(
      err?.response?.data ||
      err.message
    );

    return res.status(500).json({
      success: false,

      error:
        err?.response?.data ||
        err.message ||
        "Submission failed",
    });
  }
}
