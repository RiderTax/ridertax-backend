import pkg from "@supabase/supabase-js";
const { createClient } = pkg;

export default async function handler(req, res) {
// ✅ CORS
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "*");

if (req.method === "OPTIONS") {
return res.status(200).end();
}

try {
// ✅ Use correct env names (THIS WAS YOUR BUG)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

```
// ✅ Prevent empty string / undefined crash
if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL === "" || SUPABASE_KEY === "") {
  console.error("❌ Supabase env missing or empty");

  return res.status(200).json({
    connected: false,
    connected_at: null,
  });
}

// ✅ Safe client init
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { user_id } = req.query;

console.log("🔍 HMRC status check:", user_id);

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

// ✅ Handle DB errors (ignore "no rows")
if (error && error.code !== "PGRST116") {
  console.error("❌ Supabase query error:", error);

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
console.error("💥 Status API crash:", err);

```
return res.status(200).json({
  connected: false,
  connected_at: null,
});
```

}
}
