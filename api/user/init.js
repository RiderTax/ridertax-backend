import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // ✅ CORS HEADERS (CRITICAL)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ HANDLE PREFLIGHT
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

    console.log("INIT HIT:", user_id);

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    // 🔍 CHECK IF USER EXISTS
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("id", user_id)
      .single();

    if (!existingUser) {
      console.log("🆕 Creating new user...");

      const { error: insertError } = await supabase.from("users").insert({
        id: user_id,
        onboarding_completed: false,
      });

      if (insertError) {
        console.error("Insert error:", insertError);
        return res.status(500).json({ error: "Failed to create user" });
      }

      return res.status(200).json({
        onboarding_completed: false,
      });
    }

    console.log("👤 Existing user found");

    return res.status(200).json({
      onboarding_completed: existingUser.onboarding_completed,
    });

  } catch (err) {
    console.error("INIT ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
