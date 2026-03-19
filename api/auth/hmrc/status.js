import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: "Missing user_id" });
  }

  try {
    const { data, error } = await supabase
      .from("hmrc_tokens")
      .select("user_id, created_at")
      .eq("user_id", user_id)
      .maybeSingle();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Database error" });
    }

    if (!data) {
      return res.status(200).json({
        connected: false,
        connected_at: null,
      });
    }

    return res.status(200).json({
      connected: true,
      connected_at: data.created_at,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
