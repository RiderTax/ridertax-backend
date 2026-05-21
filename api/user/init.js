import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // =========================
    // ✅ CORS
    // =========================
    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS"
    );

    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type"
    );

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    // =========================
    // ✅ ONLY ALLOW POST
    // =========================
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }

    // =========================
    // ✅ PARSE BODY SAFELY
    // =========================
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

    const {
      user_id,
      email,
      full_name,
    } = body || {};

    if (!user_id) {
      return res.status(400).json({
        error: "Missing user_id",
      });
    }

    console.log("🔍 INIT USER:", user_id);

    // =========================
    // 🔎 CHECK EXISTING USER
    // =========================
    const {
      data: existingUser,
      error: lookupError,
    } = await supabase
      .from("users")
      .select("*")
      .eq("id", user_id)
      .maybeSingle();

    if (lookupError) {
      console.error(
        "❌ USER LOOKUP ERROR:",
        lookupError
      );

      return res.status(500).json({
        error: "Database lookup failed",
      });
    }

    // =========================
    // 🆕 AUTO CREATE USER
    // =========================
    if (!existingUser) {
      console.log(
        "🆕 USER NOT FOUND → AUTO CREATING"
      );

      const newUser = {
        id: user_id,

        email:
          email || null,

        full_name:
          full_name || null,

        onboarding_completed: true,

        created_at:
          new Date().toISOString(),
      };

      const {
        data: insertedUser,
        error: upsertError,
      } = await supabase
        .from("users")
        .upsert(newUser)
        .select()
        .single();

      if (upsertError) {
        console.error(
          "❌ USER CREATE ERROR:",
          upsertError
        );

        return res.status(500).json({
          error: "Failed to create user",
        });
      }

      console.log(
        "✅ USER AUTO CREATED:",
        insertedUser.id
      );

      return res.status(200).json({
        success: true,

        onboarding_completed: true,

        user: insertedUser,
      });
    }

    // =========================
    // ✅ EXISTING USER
    // =========================
    console.log(
      "✅ EXISTING USER:",
      existingUser.id
    );

    return res.status(200).json({
      success: true,

      onboarding_completed:
        existingUser.onboarding_completed ?? true,

      user: existingUser,
    });

  } catch (error) {
    console.error(
      "💥 INIT USER ERROR:",
      error
    );

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
