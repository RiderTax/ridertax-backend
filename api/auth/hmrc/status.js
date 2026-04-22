export default async function handler(req, res) {
  // ✅ CORS headers
  res.setHeader("Access-Control-Allow-Origin", "https://ridertax.co.uk");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ connected: false });
    }

    // 🔗 Supabase
    const { createClient } = await import("@supabase/supabase-js");

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (error || !data) {
      return res.status(200).json({ connected: false });
    }

    return res.status(200).json({ connected: true });

  } catch (err) {
    console.error("STATUS ERROR:", err);
    return res.status(500).json({ connected: false });
  }
}
