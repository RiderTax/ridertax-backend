import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // ✅ CORS (hardcoded – reliable)
  res.setHeader("Access-Control-Allow-Origin", "https://ridertax.co.uk");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ connected: false });
  }

  try {
    console.log("✅ STATUS API HIT");

    const user_id = req.query?.user_id;

    if (!user_id) {
      return res.status(400).json({ connected: false });
    }

    // 🔥 IMPORTANT: use SAME env as other files
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("hmrc_tokens")
      .select("user_id")
      .eq("user_id", user_id)
      .maybeSingle();

    if (error) {
      console.error("❌ DB ERROR:", error);
      return res.status(500).json({ connected: false });
    }

    return res.status(200).json({
      connected: !!data,
    });

  } catch (err) {
    console.error("❌ STATUS CRASH:", err);
    return res.status(500).json({ connected: false });
  }
}
