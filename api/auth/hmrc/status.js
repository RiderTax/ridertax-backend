import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { user_id } = req.query;

    // ✅ Validate input
    if (!user_id || user_id === "YOUR_USER_ID") {
      return res.status(200).json({
        connected: false,
        connected_at: null,
      });
    }

    const { data, error } = await supabase
      .from("hmrc_tokens")
      .select("created_at")
      .eq("user_id", user_id)
      .maybeSingle();

    // ✅ Ignore "no rows" error
    if (error && error.code !== "PGRST116") {
      console.error("Supabase error:", error);
      return res.status(200).json({
        connected: false,
        connected_at: null,
      });
    }

    return res.status(200).json({
      connected: !!data,
      connected_at: data?.created_at || null,
    });

  } catch (err) {
    console.error("Server crash:", err);

    // ✅ NEVER crash frontend
    return res.status(200).json({
      connected: false,
      connected_at: null,
    });
  }
}
