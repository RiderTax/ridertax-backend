import { createClient } from "@supabase/supabase-js";
import { applyCors } from "../../utils/cors";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // ✅ Apply CORS
  const isPreflight = applyCors(req, res);
  if (isPreflight) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

    const user_id = body?.user_id;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    console.log("🔌 Disconnect:", user_id);

    const { error } = await supabase
      .from("hmrc_tokens")
      .delete()
      .eq("user_id", user_id);

    if (error) {
      console.error("❌ DB error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    return res.status(200).json({
      success: true,
      disconnected: true,
    });

  } catch (err) {
    console.error("❌ Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
