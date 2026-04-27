import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    // ✅ CORS (important for frontend)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("🔍 INIT USER:", user_id);

    // =========================
    // 🔎 CHECK USER
    // =========================
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", user_id)
      .maybeSingle();

    if (error) {
      console.error("❌ DB ERROR:", error);
      return res.status(500).json({ error: "DB error" });
    }

    // =========================
    // 🆕 CREATE USER IF NOT EXISTS
    // =========================
    if (!user) {
      console.log("🆕 USER NOT FOUND → CREATING (SKIP ONBOARDING)");

      const { error: insertError } = await supabase
        .from("users")
        .insert({
          id: user_id,
          onboarding_completed: true, // 🔥 THIS IS THE MAGIC
        });

      if (insertError) {
        console.error("❌ INSERT ERROR:", insertError);
        return res.status(500).json({ error: "Insert failed" });
      }

      return res.status(200).json({
        onboarding_completed: true,
      });
    }

    // =========================
    // ✅ EXISTING USER
    // =========================
    console.log("✅ USER FOUND:", user);

    return res.status(200).json({
      onboarding_completed: user.onboarding_completed ?? true,
    });

  } catch (err) {
    console.error("💥 INIT ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
