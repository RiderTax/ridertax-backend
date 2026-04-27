import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // ✅ CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const { user_id } = body;

    console.log("INIT USER:", user_id);

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    // ✅ SAFE QUERY (NO CRASH)
    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", user_id);

    if (error) {
      console.error("FETCH ERROR:", error);
      return res.status(500).json({ error: error.message });
    }

    const existingUser = users[0];

    // 🆕 CREATE USER
    if (!existingUser) {
      console.log("Creating new user...");

      const { error: insertError } = await supabase
        .from("users")
        .insert([
          {
            id: user_id,
            onboarding_completed: false,
          },
        ]);

      if (insertError) {
        console.error("INSERT ERROR:", insertError);
        return res.status(500).json({ error: insertError.message });
      }

      return res.status(200).json({
        onboarding_completed: false,
      });
    }

    // 👤 EXISTING USER
    console.log("User exists");

    return res.status(200).json({
      onboarding_completed: existingUser.onboarding_completed,
    });

  } catch (err) {
    console.error("CRASH:", err);
    return res.status(500).json({ error: err.message });
  }
}
