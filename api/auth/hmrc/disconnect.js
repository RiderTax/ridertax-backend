import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  console.log("METHOD:", req.method);
  console.log("BODY:", req.body);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user_id } = req.body || {};

    console.log("USER_ID RECEIVED:", user_id);

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    const { data, error } = await supabase
      .from("hmrc_tokens")
      .delete()
      .eq("user_id", user_id)
      .select();

    console.log("DELETE RESULT:", data, error);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Disconnect crash:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
