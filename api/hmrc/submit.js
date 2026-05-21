import axios from "axios";
import crypto from "crypto";

import { createClient } from "@supabase/supabase-js";

import { buildFraudHeaders } from "../../utils/hmrcFraudHeaders.js";
import { logHmrcEvent } from "../../utils/logHmrcEvent.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // =========================
  // CORS
  // =========================
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // =========================
    // ONLY POST
    // =========================
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    const {
      user_id,
      tax_year,
      business_id,
      payload,
    } = req.body;

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

    if (!business_id) {
      return res.status(400).json({
        success: false,
        error: "Missing business_id",
      });
    }

    if (
      !payload ||
      typeof payload !== "object"
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid submission payload",
      });
    }

    console.log(
      "🚀 HMRC SUBMIT START:",
      {
        user_id,
        tax_year,
        business_id,
      }
    );

    // =========================
    // GET HMRC TOKENS
    // =========================
    const {
      data: tokenRow,
      error: tokenError,
    } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (tokenError) {
      console.error(
        "❌ TOKEN FETCH ERROR:",
        tokenError
      );

      await logHmrcEvent({
        user_id,

        endpoint:
          "/oauth/token",

        method: "POST",

        response_status: 500,

        error_message:
          tokenError.message,
      });

      return res.status(500).json({
        success: false,
        error:
          "Failed to fetch HMRC tokens",
      });
    }

    if (!tokenRow) {
      return res.status(404).json({
        success: false,
        error:
          "HMRC account not connected",
      });
    }

    // =========================
    // AUTO TOKEN REFRESH
    // =========================
    let accessToken =
      tokenRow.access_token;

    const expiry = new Date(
      tokenRow.expires_at
    );

    const now = new Date();

    // refresh if less than 5 mins left
    if (
      expiry.getTime() -
        now.getTime() <
      5 * 60 * 1000
    ) {
      console.log(
        "🔄 REFRESHING TOKEN"
      );

      try {
        const refreshResponse =
          await axios.post(
            process.env
              .HMRC_TOKEN_URL,

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

        const refreshed =
          refreshResponse.data;

        accessToken =
          refreshed.access_token;

        const expiresAt =
          new Date(
            Date.now() +
              refreshed.expires_in *
                1000
          ).toISOString();

        // update DB
        await supabase
          .from("hmrc_tokens")
          .update({
            access_token:
              refreshed.access_token,

            refresh_token:
              refreshed.refresh_token,

            expires_at:
              expiresAt,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "user_id",
            user_id
          );

        console.log(
          "✅ TOKEN REFRESHED"
        );

      } catch (refreshErr) {
        console.error(
          "❌ TOKEN REFRESH FAILED:",
          refreshErr?.response
            ?.data ||
            refreshErr.message
        );

        await logHmrcEvent({
          user_id,

          endpoint:
            "/oauth/token",

          method: "POST",

          response_status:
            refreshErr?.response
              ?.status || 500,

          response_body:
            refreshErr?.response
              ?.data || {},

          error_message:
            refreshErr.message,
        });

        return res.status(401).json({
          success: false,
          error:
            "Failed to refresh HMRC token",
        });
      }
    }

    // =========================
    // CORRELATION ID
    // =========================
    const correlationId =
      crypto.randomUUID();

    // =========================
    // BUILD FRAUD HEADERS
    // =========================
    const fraudHeaders =
      buildFraudHeaders(req);

    // =========================
    // HMRC ENDPOINT
    // =========================
    const endpoint =
      `${process.env.HMRC_BASE_URL}` +
      `/individuals/business/self-assessment/${tax_year}/${business_id}`;

    console.log(
      "📡 HMRC SUBMIT ENDPOINT:",
      endpoint
    );

    // =========================
    // HMRC SUBMISSION
    // =========================
    let hmrcResponse;

    try {
      hmrcResponse =
        await axios.post(
          endpoint,
          payload,
          {
            timeout: 30000,

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",

              Accept:
                "application/vnd.hmrc.1.0+json",

              CorrelationId:
                correlationId,

              ...fraudHeaders,
            },
          }
        );

    } catch (submitErr) {
      console.error(
        "❌ HMRC SUBMIT ERROR:",
        submitErr?.response
          ?.data ||
          submitErr.message
      );

      // =========================
      // SAVE FAILED LOG
      // =========================
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
          payload,

        response_status:
          submitErr?.response
            ?.status || 500,

        response_body:
          submitErr?.response
            ?.data || {},

        correlation_id:
          correlationId,

        error_message:
          submitErr.message,
      });

      return res.status(
        submitErr?.response
          ?.status || 500
      ).json({
        success: false,

        correlation_id:
          correlationId,

        error:
          submitErr?.response
            ?.data ||
          submitErr.message,
      });
    }

    // =========================
    // SAVE SUCCESS LOG
    // =========================
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
        payload,

      response_status:
        hmrcResponse.status,

      response_body:
        hmrcResponse.data,

      correlation_id:
        correlationId,
    });

    console.log(
      "✅ HMRC SUBMISSION SUCCESS"
    );

    // =========================
    // SUCCESS RESPONSE
    // =========================
    return res.status(200).json({
      success: true,

      correlation_id:
        correlationId,

      hmrc_response:
        hmrcResponse.data,
    });

  } catch (err) {
    console.error(
      "💥 SUBMIT CRASH:",
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
