import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // =========================
    // CORS
    // =========================
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type"
    );

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    // =========================
    // ONLY GET
    // =========================
    if (req.method !== "GET") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    // =========================
    // QUERY PARAMS
    // =========================
    const {
      user_id,
      endpoint,
      limit = 50,
      offset = 0,
    } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id",
      });
    }

    // =========================
    // BUILD QUERY
    // =========================
    let query = supabase
      .from("hmrc_logs")
      .select("*", { count: "exact" })
      .eq("user_id", user_id)
      .order("created_at", {
        ascending: false,
      })
      .range(
        Number(offset),
        Number(offset) + Number(limit) - 1
      );

    // =========================
    // OPTIONAL ENDPOINT FILTER
    // =========================
    if (endpoint) {
      query = query.eq("endpoint", endpoint);
    }

    // =========================
    // EXECUTE QUERY
    // =========================
    const {
      data,
      error,
      count,
    } = await query;

    if (error) {
      console.error("❌ LOG FETCH ERROR:", error);

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    // =========================
    // SANITIZE TOKENS
    // =========================
    const sanitizedLogs = (data || []).map((log) => {
      const cleanLog = { ...log };

      // Remove sensitive auth headers
      if (
        cleanLog.request_headers?.Authorization
      ) {
        cleanLog.request_headers.Authorization =
          "[REDACTED]";
      }

      // Remove access tokens from responses
      if (
        cleanLog.response_body?.access_token
      ) {
        cleanLog.response_body.access_token =
          "[REDACTED]";
      }

      if (
        cleanLog.response_body?.refresh_token
      ) {
        cleanLog.response_body.refresh_token =
          "[REDACTED]";
      }

      return cleanLog;
    });

    // =========================
    // SUCCESS
    // =========================
    return res.status(200).json({
      success: true,
      total: count || 0,
      limit: Number(limit),
      offset: Number(offset),
      logs: sanitizedLogs,
    });

  } catch (err) {
    console.error("💥 LOGS ERROR:", err);

    return res.status(500).json({
      success: false,
      error:
        err.message ||
        "Failed to fetch HMRC logs",
    });
  }
}
