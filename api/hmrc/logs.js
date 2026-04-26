import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // ✅ CORS (important)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    const { data, error } = await supabase
      .from("hmrc_logs")
      .select("id, created_at")
      .eq("user_id", user_id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      count: data.length,
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message,
    });
  }
}
