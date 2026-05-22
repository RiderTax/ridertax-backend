import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function applyCors(req, res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://ridertax.co.uk"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }

  return false;
}

export default async function handler(req, res) {

  // =========================
  // APPLY CORS
  // =========================

  const ended = applyCors(req, res);

  if (ended) return;

  try {

    const {
      user_id,
      user_email,
      tax_year
    } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id"
      });
    }

    if (!user_email) {
      return res.status(400).json({
        success: false,
        error: "Missing user_email"
      });
    }

    // =========================
    // LOAD USER
    // =========================

    const { data: user, error: userError } =
      await supabase
        .from("users")
        .select("*")
        .eq("id", user_id)
        .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    const nino = user.nino;
    const utr = user.utr;

    if (!nino) {
      return res.status(400).json({
        success: false,
        error: "Missing NINO"
      });
    }

    if (!utr) {
      return res.status(400).json({
        success: false,
        error: "Missing UTR"
      });
    }

    // =========================
    // FETCH BASE44 SUMMARY
    // =========================

    const annualResponse = await fetch(
      process.env.BASE44_ANNUAL_SUMMARY_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key":
            process.env.BASE44_SECRET
        },
        body: JSON.stringify({
          user_email,
          tax_year
        })
      }
    );

    const annualData =
      await annualResponse.json();

    if (!annualData.success) {
      return res.status(500).json({
        success: false,
        error:
          annualData.error ||
          "Failed loading annual summary"
      });
    }

    const summary = annualData.summary;

    // =========================
    // HMRC PAYLOAD
    // =========================

    const hmrcPayload = {
      nino,
      utr,
      taxYear: tax_year,
      income:
        summary.income || 0,
      expenses:
        summary.expenses || 0,
      mileage:
        summary.mileage_deduction || 0,
      profit:
        summary.profit || 0
    };

    console.log(
      "✅ HMRC Annual Payload:",
      hmrcPayload
    );

    // =========================
    // SUCCESS
    // =========================

    return res.status(200).json({
      success: true,
      submission_id:
        "SA-" +
        Math.random()
          .toString(36)
          .substring(2, 10)
          .toUpperCase(),
      hmrc_payload: hmrcPayload
    });

  } catch (err) {

    console.error(
      "❌ SUBMIT ANNUAL ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
