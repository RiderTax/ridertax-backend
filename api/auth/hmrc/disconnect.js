import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    await supabase
      .from("hmrc_tokens")
      .delete()
      .eq("user_id", user_id);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Disconnect error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
