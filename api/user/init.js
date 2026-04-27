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

    // 🔍 Check if user exists
    const { data: existing, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", user_id)
      .single();

    if (!existing) {
      console.log("❌ USER NOT FOUND → creating");

      const { error: insertError } = await supabase
        .from("users")
        .insert({
          id: user_id, // ✅ CRITICAL (NOT user_id column)
          onboarding_completed: false
        });

      if (insertError) {
        console.error("INSERT ERROR:", insertError);
        return res.status(500).json({ error: insertError.message });
      }

      return res.json({
        onboarding_completed: false
      });
    }

    console.log("✅ USER FOUND:", existing.id);

    return res.json({
      onboarding_completed: existing.onboarding_completed
    });

  } catch (err) {
    console.error("INIT ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
