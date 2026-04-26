import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // ✅ ALWAYS set CORS headers FIRST
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Handle preflight properly
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

    const user_id = body?.user_id;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    console.log("🔌 Disconnect request:", user_id);

    const { error } = await supabase
      .from("hmrc_tokens")
      .delete()
      .eq("user_id", user_id);

    if (error) {
      console.error("❌ Supabase error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    // ✅ IMPORTANT: include CORS header in FINAL response too
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.status(200).json({
      success: true,
      disconnected: true,
    });

  } catch (err) {
    console.error("❌ Server error:", err);

    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.status(500).json({ error: "Server error" });
  }
}
