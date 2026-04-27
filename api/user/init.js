import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    // check if exists
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("id", user_id)
      .single();

    if (!existing) {
      await supabase.from("users").insert({
        id: user_id, // ✅ IMPORTANT: use "id" (your table column)
        onboarding_completed: false,
      });

      console.log("✅ User created:", user_id);
    }

    return res.json({ success: true });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
