import { applyCors } from "../../utils/cors.js";

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

    const {
      user_id,
      nino,
      tax_year,
      business_id,
      income,
      expenses,
      period_start,
      period_end,
    } = req.body || {};

    // =========================
    // ✅ REQUIRED FIELDS
    // =========================
    const errors = [];

    if (!user_id) {
      errors.push({
        field: "user_id",
        message: "User ID is required",
      });
    }

    if (!nino) {
      errors.push({
        field: "nino",
        message: "NINO is required",
      });
    }

    if (!tax_year) {
      errors.push({
        field: "tax_year",
        message: "Tax year is required",
      });
    }

    if (!business_id) {
      errors.push({
        field: "business_id",
        message: "Business ID is required",
      });
    }

    // =========================
    // ✅ NINO VALIDATION
    // =========================
    if (nino) {
      const cleanNino = nino
        .replace(/\s+/g, "")
        .toUpperCase();

      const ninoRegex =
        /^[A-CEGHJ-PR-TW-Z]{2}[0-9]{6}[A-D]$/;

      if (!ninoRegex.test(cleanNino)) {
        errors.push({
          field: "nino",
          message:
            "Invalid UK National Insurance Number format",
        });
      }
    }

    // =========================
    // ✅ TAX YEAR VALIDATION
    // =========================
    if (tax_year) {
      const taxYearRegex =
        /^\d{4}-\d{2}$/;

      if (!taxYearRegex.test(tax_year)) {
        errors.push({
          field: "tax_year",
          message:
            "Tax year must be in format YYYY-YY",
        });
      }
    }

    // =========================
    // ✅ DATE VALIDATION
    // =========================
    if (
      period_start &&
      isNaN(Date.parse(period_start))
    ) {
      errors.push({
        field: "period_start",
        message:
          "Invalid period start date",
      });
    }

    if (
      period_end &&
      isNaN(Date.parse(period_end))
    ) {
      errors.push({
        field: "period_end",
        message:
          "Invalid period end date",
      });
    }

    // =========================
    // ✅ INCOME VALIDATION
    // =========================
    if (
      income !== undefined &&
      (isNaN(income) || Number(income) < 0)
    ) {
      errors.push({
        field: "income",
        message:
          "Income must be a positive number",
      });
    }

    // =========================
    // ✅ EXPENSE VALIDATION
    // =========================
    if (
      expenses !== undefined &&
      (isNaN(expenses) || Number(expenses) < 0)
    ) {
      errors.push({
        field: "expenses",
        message:
          "Expenses must be a positive number",
      });
    }

    // =========================
    // ✅ BUSINESS RULES
    // =========================
    if (
      Number(expenses) >
      Number(income) * 5
    ) {
      errors.push({
        field: "expenses",
        message:
          "Expenses unusually high compared to income",
        warning: true,
      });
    }

    // =========================
    // ✅ DATE RANGE CHECK
    // =========================
    if (
      period_start &&
      period_end &&
      new Date(period_start) >
        new Date(period_end)
    ) {
      errors.push({
        field: "period_range",
        message:
          "Period start date cannot be after period end date",
      });
    }

    // =========================
    // ✅ VALIDATION RESULT
    // =========================
    const blockingErrors = errors.filter(
      (e) => !e.warning
    );

    if (blockingErrors.length > 0) {
      return res.status(400).json({
        success: false,
        valid: false,
        errors,
      });
    }

    // =========================
    // ✅ SUCCESS
    // =========================
    return res.status(200).json({
      success: true,
      valid: true,
      warnings: errors.filter(
        (e) => e.warning
      ),
      message:
        "Validation successful",
    });

  } catch (err) {
    console.error(
      "💥 VALIDATION ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      valid: false,
      error:
        err.message ||
        "Validation failed",
    });
  }
}
