import { createClient } from "@supabase/supabase-js";
import { logHmrcEvent } from "../../utils/logHmrcEvent.js";
import { buildFraudHeaders } from "../../utils/hmrcFraudHeaders.js";
import { applyCors } from "../../utils/cors.js";

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
    // GET HMRC TOKEN
    // =========================================
    const {
      data: tokenRow,
      error: tokenError,
    } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (tokenError || !tokenRow) {
      return res.status(401).json({
        success: false,
        error: "HMRC connection not found",
      });
    }

    // =========================================
    // GET USER PROFILE
    // =========================================
    const {
      data: userRow,
      error: userError,
    } = await supabase
      .from("users")
      .select("*")
      .eq("id", user_id)
      .single();

    if (userError || !userRow) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // =========================================
    // VALIDATE NINO
    // =========================================
    const nino =
      tokenRow.nino ||
      userRow.nino;

    if (!nino) {
      return res.status(400).json({
        success: false,
        error: "Missing NINO",
      });
    }

    // =========================================
    // VALIDATE UTR
    // =========================================
    const utr =
      userRow.utr ||
      userRow.utr_number;

    if (!utr) {
      return res.status(400).json({
        success: false,
        error: "Missing UTR",
      });
    }

    // =========================================
    // LOAD TRANSACTIONS
    // =========================================
    const {
      data: transactions,
      error: txError,
    } = await supabase
      .from("transactions")
      .select("*")
      .eq("created_by", user_id);

    if (txError) {
      console.error(txError);

      return res.status(500).json({
        success: false,
        error:
          "Failed to load transactions",
      });
    }

    // =========================================
    // CALCULATE TOTALS
    // =========================================
    let income = 0;
    let expenses = 0;

    for (const tx of transactions || []) {

      const amount =
        Number(tx.amount) || 0;

      if (
        tx.type === "income" ||
        tx.transaction_type === "income"
      ) {
        income += amount;
      } else {
        expenses += amount;
      }
    }

    const profit =
      income - expenses;

    console.log("📊 TOTALS:", {
      income,
      expenses,
      profit,
    });

    // =========================================
    // BUILD HMRC PAYLOAD
    // =========================================
    const payload = {
      utr,
      nino,
      taxYear: tax_year,

      income: {
        turnover: Number(
          income.toFixed(2)
        ),
      },

      expenses: {
        consolidatedExpenses: Number(
          expenses.toFixed(2)
        ),
      },

      profit: Number(
        profit.toFixed(2)
      ),

      submittedAt:
        new Date().toISOString(),
    };

    console.log(
      "📦 PAYLOAD:",
      JSON.stringify(payload, null, 2)
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
              `Bearer ${tokenRow.access_token}`,

            Accept:
              "application/vnd.hmrc.1.0+json",

            ...fraudHeaders,
          },
        }
      );

    const hmrcData =
      await hmrcResponse.json();

    console.log(
      "📨 HMRC RESPONSE:",
      hmrcData
    );

    // =========================================
    // LOG EVENT
    // =========================================
    await logHmrcEvent({
      user_id,
      endpoint:
        "/annual-self-assessment",
      method: "POST",
      response_status:
        hmrcResponse.status,
      response_body: hmrcData,
    });

    // =========================================
    // HANDLE FAILURE
    // =========================================
    if (!hmrcResponse.ok) {
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
    await supabase
      .from("hmrc_submissions")
      .insert({
        user_id,
        tax_year,
        utr,
        nino,
        income,
        expenses,
        profit,
        correlation_id:
          hmrcResponse.headers.get(
            "correlationid"
          ) || null,
        created_at:
          new Date().toISOString(),
      });

    // =========================================
    // SUCCESS
    // =========================================
    return res.status(200).json({
      success: true,

      message:
        "Annual Self Assessment submitted successfully",

      submission: {
        tax_year,
        income,
        expenses,
        profit,
      },

      hmrc_response:
        hmrcData,
    });

  } catch (err) {

    console.error(
      "💥 ANNUAL SUBMISSION ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
