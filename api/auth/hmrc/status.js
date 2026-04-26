import { createClient } from "@supabase/supabase-js";
import { applyCors } from "../../utils/cors";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // ✅ Apply global CORS
  const isPreflight = applyCors(req, res);
  if (isPreflight) return;

  if (req.method !== "GET") {
    return res.status(405).json({ connected: false });
  }

  try {
    const user_id = req.query?.user_id;

    if (!user_id) {
      return res.status(400).json({ connected: false });
    }

    console.log("🔍 Checking HMRC status for:", user_id);

    const { data, error } = await supabase
      .from("hmrc_tokens")
      .select("user_id") // ✅ lightweight query
      .eq("user_id", user_id)
      .maybeSingle(); // ✅ safer than .single()

    if (error) {
      console.error("❌ DB error:", error);
      return res.status(500).json({ connected: false });
    }

    const connected = !!data;

    return res.status(200).json({ connected });

  } catch (err) {
    console.error("❌ STATUS ERROR:", err);
    return res.status(500).json({ connected: false });
  }
}
