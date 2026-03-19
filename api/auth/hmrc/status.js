import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // ✅ CORS HEADERS (VERY IMPORTANT)
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://rider-tax-flow.base44.app"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { user_id } = req.query;

    console.log("Checking HMRC status for user:", user_id);

    // ✅ Validate input
    if (!user_id || user_id === "YOUR_USER_ID") {
      return res.status(200).json({
        connected: false,
        connected_at: null,
      });
    }

    const { data, error } = await supabase
      .from("hmrc_tokens")
      .select("created_at")
      .eq("user_id", user_id)
      .maybeSingle();

    // ✅ Ignore "no rows found"
    if (error && error.code !== "PGRST116") {
      console.error("Supabase error:", error);
      return res.status(200).json({
        connected: false,
        connected_at: null,
      });
    }

    console.log("HMRC status result:", data);

    return res.status(200).json({
      connected: !!data,
      connected_at: data?.created_at || null,
    });

  } catch (err) {
    console.error("Server crash:", err);

    // ✅ Never break frontend
    return res.status(200).json({
      connected: false,
      connected_at: null,
    });
  }
}
