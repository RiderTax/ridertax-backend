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
  .select("created_at")
  .eq("user_id", user_id)
  .maybeSingle();

// ✅ IMPORTANT FIX
if (error && error.code !== "PGRST116") {
  console.error(error);
  return res.status(500).json({ error: "Database error" });
}

// ✅ No row = not connected (NORMAL)
return res.status(200).json({
  connected: !!data,
  connected_at: data?.created_at || null,
});
    return res.status(500).json({ error: "Server error" });
  }
}
