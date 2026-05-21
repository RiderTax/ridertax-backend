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

    const { error } = await supabase
      .from("hmrc_tokens")
      .delete()
      .eq("user_id", user_id);

    if (error) {
      await logHmrcEvent({
        user_id,
        endpoint: "/disconnect",
        method: "POST",
        response_status: 500,
        error_message: error.message,
      });

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    await logHmrcEvent({
      user_id,
      endpoint: "/disconnect",
      method: "POST",
      response_status: 200,
      response_body: {
        disconnected: true,
      },
    });

    return res.status(200).json({
      success: true,
      disconnected: true,
    });

  } catch (err) {
    console.error(
      "💥 DISCONNECT ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
