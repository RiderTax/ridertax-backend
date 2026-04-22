import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
try {
const { code, state } = req.query;

```
console.log("HMRC callback received:", { code, state });

if (!code) {
  return res.status(400).send("Missing code");
}

// ✅ ENV check
const {
  HMRC_CLIENT_ID,
  HMRC_CLIENT_SECRET,
  HMRC_REDIRECT_URI,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (!HMRC_CLIENT_ID || !HMRC_CLIENT_SECRET || !HMRC_REDIRECT_URI) {
  console.error("Missing HMRC env");
  return res.status(500).send("Server config error");
}

// ✅ Exchange code for token
const tokenRes = await fetch("https://test-api.service.hmrc.gov.uk/oauth/token", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    client_id: HMRC_CLIENT_ID,
    client_secret: HMRC_CLIENT_SECRET,
    redirect_uri: HMRC_REDIRECT_URI,
    code,
  }),
});

const tokenData = await tokenRes.json();

console.log("HMRC token response:", tokenData);

if (!tokenData.access_token) {
  throw new Error("Failed to get token");
}

// ✅ Save to Supabase
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  await supabase.from("hmrc_tokens").upsert({
    user_id: state || "unknown_user",
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    created_at: new Date().toISOString(),
  });
}

// ✅ Redirect back to app
return res.redirect("https://rider-tax-flow.base44.app/settings?hmrc=success");
```

} catch (err) {
console.error("💥 HMRC callback crash:", err);

```
return res.redirect("https://rider-tax-flow.base44.app/settings?hmrc=failed");
```

}
}
