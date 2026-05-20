import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        connected: false,
        error: "Missing user_id",
      });
    }

    const { data, error } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (error || !data) {
      return res.status(200).json({
        connected: false,
      });
    }

    const now = new Date();
    const expiresAt = new Date(data.expires_at);

    const expired = now > expiresAt;

    return res.status(200).json({
      connected: true,
      expired,
      expires_at: data.expires_at,
      scope: data.scope,
      updated_at: data.updated_at,
    });
  } catch (error) {
    console.error("HMRC Status Error:", error);

    return res.status(500).json({
      connected: false,
      error: "Failed to fetch HMRC status",
    });
  }
}
