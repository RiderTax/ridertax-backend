const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  // ✅ CORS (safe)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    console.log("🚀 STATUS API HIT");

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // ✅ Env check
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error("❌ Missing env vars");
      return res.status(200).json({
        connected: false,
        connected_at: null,
        debug: "missing env",
      });
    }

    // ✅ Init client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { user_id } = req.query;

    // ✅ Input check
    if (!user_id) {
      return res.status(200).json({
        connected: false,
        connected_at: null,
        debug: "no user_id",
      });
    }

    console.log("🔍 Checking user:", user_id);

    // ✅ Query DB
    const { data, error } = await supabase
      .from("hmrc_tokens")
      .select("created_at")
      .eq("user_id", user_id)
      .maybeSingle();

    // ✅ Handle DB error (ignore no rows)
    if (error && error.code !== "PGRST116") {
      console.error("❌ DB error:", error);
      return res.status(200).json({
        connected: false,
        connected_at: null,
        debug: "db error",
      });
    }

    console.log("✅ Result:", data);

    return res.status(200).json({
      connected: !!data,
      connected_at: data?.created_at || null,
    });
  } catch (err) {
    console.error("💥 STATUS CRASH:", err);

    return res.status(200).json({
      connected: false,
      connected_at: null,
      debug: "crash",
    });
  }
};
