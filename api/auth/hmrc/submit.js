import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { buildFraudHeaders } from "../../utils/hmrcFraudHeaders";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { user_id, income, expenses, period_start, period_end } = req.body;

    // ✅ Validate input
    if (!user_id || income == null || expenses == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const profit = income - expenses;

    // 🔍 Get tokens
    const { data: tokenData, error } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (error || !tokenData) {
      return res.status(401).json({ error: "No HMRC connection" });
    }

    let accessToken = tokenData.access_token;

    // 🔁 Refresh token (SAFE)
    try {
      const refresh = await axios.post(
        "https://test-api.service.hmrc.gov.uk/oauth/token",
        new URLSearchParams({
          grant_type: "refresh_token",
          client_id: process.env.HMRC_CLIENT_ID,
          client_secret: process.env.HMRC_CLIENT_SECRET,
          refresh_token: tokenData.refresh_token,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      accessToken = refresh.data.access_token;

      await supabase
        .from("hmrc_tokens")
        .update({
          access_token: refresh.data.access_token,
          refresh_token: refresh.data.refresh_token,
        })
        .eq("user_id", user_id);

    } catch (err) {
      console.warn("⚠️ Token refresh failed, using existing token");
    }

    // 📦 HMRC payload (example — will refine later)
    const payload = {
      fromDate: period_start,
      toDate: period_end,
      financials: {
        incomes: {
          turnover: income
        },
        deductions: {
          totalExpenses: expenses
        }
      }
    };

    // ✅ PROPER FRAUD HEADERS (CENTRALISED)
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...buildFraudHeaders(req, user_id),
    };

    // 🚀 HMRC API CALL (sandbox)
    const response = await axios.post(
      "https://test-api.service.hmrc.gov.uk/individuals/self-assessment/periodic-summary",
      payload,
      { headers }
    );

    // 💾 Store success
    await supabase.from("hmrc_submissions").insert({
      user_id,
      period_start,
      period_end,
      income,
      expenses,
      profit,
      hmrc_response: response.data,
      status: "submitted"
    });

    return res.json({
      success: true,
      hmrc_response: response.data
    });

  } catch (err) {
    console.error("❌ HMRC submission error:", err.response?.data || err.message);

    // 💾 Store failure
    try {
      await supabase.from("hmrc_submissions").insert({
        user_id: req.body?.user_id,
        income: req.body?.income,
        expenses: req.body?.expenses,
        status: "failed",
        hmrc_response: err.response?.data || err.message
      });
    } catch {}

    return res.status(500).json({
      error: "HMRC submission failed",
      details: err.response?.data || err.message
    });
  }
}
