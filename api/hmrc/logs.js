import { createClient } from "@supabase/supabase-js";
import { applyCors } from "../../utils/cors.js";

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

    const {
      user_id,
      limit = 50,
      offset = 0,
    } = req.body || {};

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id",
      });
    }

    console.log(
      "📜 FETCH HMRC LOGS:",
      user_id
    );

    // =========================
    // ✅ FETCH LOGS
    // =========================
    const {
      data: logs,
      error,
      count,
    } = await supabase
      .from("hmrc_logs")
      .select("*", {
        count: "exact",
      })
      .eq("user_id", user_id)
      .order("created_at", {
        ascending: false,
      })
      .range(
        offset,
        offset + limit - 1
      );

    if (error) {
      console.error(
        "❌ LOG FETCH ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to fetch logs",
      });
    }

    // =========================
    // ✅ FORMAT LOGS
    // =========================
    const formattedLogs =
      (logs || []).map((log) => ({
        id: log.id,
        action: log.action,
        endpoint: log.endpoint || null,
        status: log.status,
        correlation_id:
          log.correlation_id || null,
        created_at: log.created_at,
      }));

    // =========================
    // ✅ SUCCESS RESPONSE
    // =========================
    return res.status(200).json({
      success: true,

      total: count || 0,

      limit,

      offset,

      logs: formattedLogs,
    });

  } catch (err) {
    console.error(
      "💥 LOGS ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      error:
        err.message ||
        "Failed to fetch logs",
    });
  }
}
