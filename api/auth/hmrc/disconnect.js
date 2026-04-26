import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY
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
    // ✅ Safe body parsing
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

    const user_id = body?.user_id;

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    console.log("Disconnect request for:", user_id);

    // ✅ Step 1: Check if tokens exist (debugging clarity)
    const { data: existing, error: fetchError } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id);

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      return res.status(500).json({ error: "Database fetch error" });
    }

    console.log("Existing tokens:", existing?.length || 0);

    // ✅ Step 2: Delete tokens
    const { error: deleteError } = await supabase
      .from("hmrc_tokens")
      .delete()
      .eq("user_id", user_id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return res.status(500).json({ error: "Database delete error" });
    }

    // ✅ Step 3: VERIFY deletion (THIS IS KEY)
    const { data: afterDelete } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id);

    const isDisconnected = !afterDelete || afterDelete.length === 0;

    console.log("After delete tokens:", afterDelete?.length || 0);

    return res.status(200).json({
      success: true,
      disconnected: isDisconnected,
    });

  } catch (err) {
    console.error("Disconnect crash:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
