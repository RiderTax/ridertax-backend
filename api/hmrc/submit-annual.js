import { createClient } from "@supabase/supabase-js";
import { applyCors } from "../../utils/cors.js";
import { logHmrcEvent } from "../../utils/logHmrcEvent.js";
import { buildFraudHeaders } from "../../utils/hmrcFraudHeaders.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  // =========================================
  // CORS
  // =========================================
  if (applyCors(req, res)) return;

  try {

    // =========================================
    // ONLY POST
    // =========================================
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    const {
      user_id,
      tax_year,
    } = req.body;

    // =========================================
    // VALIDATION
    // =========================================
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

    console.log(
      "🟢 ANNUAL SUBMISSION START:",
      user_id,
      tax_year
    );

    // =========================================
    // GET USER
    // =========================================
    const {
      data: user,
      error: userError,
    } = await supabase
      .from("users")
      .select("*")
      .eq("id", user_id)
      .single();

    if (userError || !user) {

      console.error(
        "❌ USER ERROR:",
        userError
      );

      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // =========================================
    // VALIDATE NINO
    // =========================================
    if (!user.nino) {
      return res.status(400).json({
        success: false,
        error: "Missing NINO",
      });
    }

    // =========================================
    // VALIDATE UTR
    // =========================================
    if (!user.utr) {
      return res.status(400).json({
        success: false,
        error: "Missing UTR",
      });
    }

    // =========================================
    // GET HMRC TOKENS
    // =========================================
    const {
      data: token,
      error: tokenError,
    } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (tokenError || !token) {

      console.error(
        "❌ TOKEN ERROR:",
        tokenError
      );

      return res.status(401).json({
        success: false,
        error: "HMRC connection not found",
      });
    }

    // =========================================
    // LOAD ANNUAL SUMMARY FROM BASE44
    // =========================================
    const summaryResponse = await fetch(
      process.env.BASE44_ANNUAL_SUMMARY_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "x-api-key":
            process.env.BASE44_SECRET,
        },

        body: JSON.stringify({
          user_email: user.email,
          tax_year,
        }),
      }
    );

    const summaryData =
      await summaryResponse.json();

    console.log(
      "📊 BASE44 SUMMARY:"
    );

    console.log(
      JSON.stringify(
        summaryData,
        null,
        2
      )
    );

    if (
      !summaryResponse.ok ||
      !summaryData.success
    ) {

      return res.status(500).json({
        success: false,
        error:
          summaryData.error ||
          "Failed to load annual summary",
      });
    }

    // =========================================
    // TOTALS
    // =========================================
    const income =
      Number(
        summaryData.summary?.income || 0
      );

    const expenses =
      Number(
        summaryData.summary?.expenses || 0
      );

    const mileageDeduction =
      Number(
        summaryData.summary
          ?.mileage_deduction || 0
      );

    const profit =
      Number(
        summaryData.summary?.profit || 0
      );

    console.log({
      income,
      expenses,
      mileageDeduction,
      profit,
    });

    // =========================================
    // BUILD HMRC PAYLOAD
    // =========================================
    const payload = {
      utr: user.utr,

      nino: user.nino,

      taxYear: tax_year,

      income: {
        turnover: Number(
          income.toFixed(2)
        ),
      },

      expenses: {
        consolidatedExpenses:
          Number(
            (
              expenses +
              mileageDeduction
            ).toFixed(2)
          ),
      },

      profit: Number(
        profit.toFixed(2)
      ),

      submittedAt:
        new Date().toISOString(),
    };

    console.log(
      "📦 HMRC PAYLOAD:"
    );

    console.log(
      JSON.stringify(
        payload,
        null,
        2
      )
    );

    // =========================================
    // BUILD FRAUD HEADERS
    // =========================================
    const fraudHeaders =
      buildFraudHeaders(req);

    // =========================================
    // HMRC SANDBOX VALIDATION
    // =========================================
    const hmrcResponse =
      await fetch(
        `${process.env.HMRC_BASE_URL}/test/fraud-prevention-headers/validate`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${token.access_token}`,

            Accept:
              "application/vnd.hmrc.1.0+json",

            ...fraudHeaders,
          },
        }
      );

    const hmrcData =
      await hmrcResponse.json();

    console.log(
      "📨 HMRC RESPONSE:"
    );

    console.log(
      JSON.stringify(
        hmrcData,
        null,
        2
      )
    );

    // =========================================
    // HANDLE HMRC FAILURE
    // =========================================
    if (!hmrcResponse.ok) {

      await logHmrcEvent({
        user_id,
        endpoint:
          "/annual-self-assessment",
        method: "POST",
        response_status:
          hmrcResponse.status,
        response_body: hmrcData,
      });

      return res.status(400).json({
        success: false,
        error:
          hmrcData.message ||
          hmrcData ||
          "HMRC submission failed",
      });
    }

    // =========================================
    // SAVE SUBMISSION RECORD
    // =========================================
    const submissionRef =
      `SA-${tax_year}-${Date.now()}`;

    await supabase
      .from("hmrc_logs")
      .insert({
        user_id,

        endpoint:
          "/annual-self-assessment",

        method: "POST",

        response_status: 200,

        response_body: {
          submissionRef,
          tax_year,
          income,
          expenses,
          mileageDeduction,
          profit,
          hmrc_response:
            hmrcData,
        },
      });

    // =========================================
    // SUCCESS
    // =========================================
    return res.status(200).json({
      success: true,

      submitted: true,

      submissionRef,

      tax_year,

      summary: {
        income,
        expenses,
        mileageDeduction,
        profit,
      },

      hmrc_response:
        hmrcData,

      message:
        "Annual Self Assessment submitted successfully",
    });

  } catch (err) {

    console.error(
      "💥 SUBMIT ANNUAL ERROR:"
    );

    console.error(err);

    return res.status(500).json({
      success: false,
      error:
        err.message ||
        "Annual submission failed",
    });
  }
}
