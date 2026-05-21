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

    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "Missing user_id",
      });
    }

    console.log("🔌 HMRC DISCONNECT:", user_id);

    // =========================
    // ✅ CHECK EXISTING TOKENS
    // =========================
    const { data: tokenRow, error: fetchError } =
      await supabase
        .from("hmrc_tokens")
        .select("*")
        .eq("user_id", user_id)
        .maybeSingle();

    if (fetchError) {
      console.error(
        "❌ TOKEN FETCH ERROR:",
        fetchError
      );

      return res.status(500).json({
        success: false,
        error: "Database error",
      });
    }

    // =========================
    // ✅ NO TOKENS FOUND
    // =========================
    if (!tokenRow) {
      return res.status(200).json({
        success: true,
        disconnected: true,
        message:
          "User already disconnected",
      });
    }

    // =========================
    // ✅ DELETE TOKENS
    // =========================
    const { error: deleteError } =
      await supabase
        .from("hmrc_tokens")
        .delete()
        .eq("user_id", user_id);

    if (deleteError) {
      console.error(
        "❌ DELETE ERROR:",
        deleteError
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to disconnect HMRC",
      });
    }

    // =========================
    // ✅ AUDIT LOG
    // =========================
    await supabase
      .from("hmrc_logs")
      .insert({
        user_id,
        action: "disconnect",
        status: "success",
        created_at:
          new Date().toISOString(),
      });

    console.log(
      "✅ HMRC DISCONNECTED:",
      user_id
    );

    // =========================
    // ✅ SUCCESS RESPONSE
    // =========================
    return res.status(200).json({
      success: true,
      disconnected: true,
      message:
        "HMRC account disconnected successfully",
    });

  } catch (err) {
    console.error(
      "💥 DISCONNECT ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      error:
        err.message ||
        "Disconnect failed",
    });
  }
}
