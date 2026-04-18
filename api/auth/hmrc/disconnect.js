import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // ✅ Handle preflight (CORS)
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 🔥 FIX: parse body manually
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body;

    console.log("RAW BODY:", req.body);
    console.log("PARSED BODY:", body);

    const user_id = body?.user_id;

    console.log("USER_ID:", user_id);

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    const { error } = await supabase
      .from("hmrc_tokens")
      .delete()
      .eq("user_id", user_id);

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Disconnect crash:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
