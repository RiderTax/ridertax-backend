import { createClient } from "@supabase/supabase-js";
import { applyCors } from "../../utils/cors.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id",
      });
    }

    // =========================
    // GET HMRC TOKENS
    // =========================
    const { data, error } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (error) {
      console.error("❌ STATUS ERROR:", error);

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    // =========================
    // NO CONNECTION
    // =========================
    if (!data) {
      return res.status(200).json({
        success: true,
        connected: false,
      });
    }

    // =========================
    // TOKEN VALIDATION
    // =========================
    const isExpired =
      new Date(data.expires_at) < new Date();

    return res.status(200).json({
      success: true,
      connected: true,
      expired: isExpired,
      scope: data.scope,
      expires_at: data.expires_at,
    });

  } catch (err) {
    console.error("💥 STATUS CRASH:", err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
