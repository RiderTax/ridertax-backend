import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
// ✅ CORS headers
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "*");

// ✅ Handle preflight once (clean)
if (req.method === "OPTIONS") {
return res.status(200).end();
}

try {
// 🔥 Validate environment variables FIRST (prevents crash)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SERVICE_ROLE_KEY;

```
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing Supabase environment variables");

  return res.status(200).json({
    connected: false,
    connected_at: null,
  });
}

// ✅ Create client safely inside handler
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { user_id } = req.query;

console.log("🔍 Checking HMRC status for user:", user_id);

// ✅ Validate input
if (!user_id || user_id === "YOUR_USER_ID") {
  return res.status(200).json({
    connected: false,
    connected_at: null,
  });
}

// ✅ Query Supabase
const { data, error } = await supabase
  .from("hmrc_tokens")
  .select("created_at")
  .eq("user_id", user_id)
  .maybeSingle();

// ✅ Handle real errors (ignore "no rows")
if (error && error.code !== "PGRST116") {
  console.error("❌ Supabase error:", error);

  return res.status(200).json({
    connected: false,
    connected_at: null,
  });
}

console.log("✅ HMRC status result:", data);

return res.status(200).json({
  connected: !!data,
  connected_at: data?.created_at || null,
});
```

} catch (err) {
console.error("💥 Server crash:", err);

```
// ✅ Never break frontend
return res.status(200).json({
  connected: false,
  connected_at: null,
});
```

}
}
