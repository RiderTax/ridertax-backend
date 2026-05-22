import { createClient } from "@supabase/supabase-js";
import { applyCors } from "../../utils/cors.js";
import { logHmrcEvent } from "../../utils/logHmrcEvent.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

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

    console.log(
      "✅ Annual submission started:",
      user_id
    );

    // =========================
    // LOAD USER
    // =========================
    const {
      data: user,
      error: userError,
    } = await supabase
      .from("users")
      .select("*")
      .eq("id", user_id)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // =========================
    // VALIDATE NINO
    // =========================
    if (!user.nino) {
      return res.status(400).json({
        success: false,
        error: "Missing NINO",
      });
    }

    // =========================
    // VALIDATE UTR
    // =========================
    if (!user.utr) {
      return res.status(400).json({
        success: false,
        error: "Missing UTR",
      });
    }

    // =========================
    // LOAD HMRC TOKEN
    // =========================
    const {
      data: token,
      error: tokenError,
    } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (tokenError || !token) {
      return res.status(401).json({
        success: false,
        error: "HMRC not connected",
      });
    }

    // =========================
    // LOAD USER TRANSACTIONS
    // =========================
    const {
      data: transactions,
      error: txError,
    } = await supabase
      .from("transactions")
      .select("*")
      .eq("created_by", user_id);

    if (txError) {
      console.error(
        "❌ TRANSACTION LOAD ERROR:",
        txError
      );

      return res.status(500).json({
        success: false,
        error: "Failed to load transactions",
      });
    }

    if (
      !transactions ||
      transactions.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "No transactions found",
      });
    }

    console.log(
      "✅ Transactions loaded:",
      transactions.length
    );

    // =========================
    // CALCULATE TOTALS
    // =========================
    let income = 0;
    let expenses = 0;

    transactions.forEach((tx) => {
      const amount =
        Number(tx.amount || 0);

      if (
        tx.type === "income"
      ) {
        income += amount;
      }

      if (
        tx.type === "expense"
      ) {
        expenses += amount;
      }
    });

    const profit =
      income - expenses;

    console.log({
      income,
      expenses,
      profit,
    });

    // =========================
    // MOCK HMRC SUBMISSION
    // =========================
    // PHASE A:
    // save annual return internally first
    // real HMRC API submission later

    const submissionRef =
      `SA-${tax_year}-${Date.now()}`;

    const {
      error: saveError,
    } = await supabase
      .from("hmrc_logs")
      .insert({
        user_id,
        endpoint:
          "/annual-self-assessment",
        method: "POST",
        response_status: 200,
        response_body: {
          tax_year,
          income,
          expenses,
          profit,
          submissionRef,
        },
      });

    if (saveError) {
      console.error(saveError);
    }

    // =========================
    // AUDIT LOG
    // =========================
    await logHmrcEvent({
      user_id,
      endpoint:
        "/annual-self-assessment",
      method: "POST",
      response_status: 200,
      response_body: {
        success: true,
        submissionRef,
      },
    });

    console.log(
      "✅ Annual return prepared"
    );

    // =========================
    // SUCCESS
    // =========================
    return res.status(200).json({
      success: true,
      submissionRef,
      tax_year,
      summary: {
        income,
        expenses,
        profit,
      },
      message:
        "Annual Self Assessment prepared successfully",
    });

  } catch (err) {
    console.error(
      "💥 SUBMIT ANNUAL ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
