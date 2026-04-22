const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  try {
    console.log("🚀 STATUS API HIT");

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { user_id } = req.query;

    if (!user_id) {
      return res.status(200).json({
        connected: false,
        connected_at: null,
        debug: "no user_id",
      });
    }

    const { data, error } = await supabase
      .from("hmrc_tokens")
      .select("created_at")
      .eq("user_id", user_id)
      .maybeSingle();

    if (error) {
      console.error(error);
    }

    return res.status(200).json({
      connected: !!data,
      connected_at: data?.created_at || null,
    });

  } catch (err) {
    console.error("💥 STATUS CRASH:", err);

    return res.status(200).json({
      connected: false,
      connected_at: null,
      debug: err.message,
    });
  }
};