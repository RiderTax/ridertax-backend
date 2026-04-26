export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // ✅ FIX 1: Read from BODY (not query)
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const { user_id, nino, utr, income, expenses } = body || {};

    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    if (!nino) {
      return res.status(400).json({ error: "Missing NINO" });
    }

    const cleanNino = nino.replace(/\s/g, "").toUpperCase();

    // =========================
    // 1️⃣ GET TOKEN
    // =========================
    const { data: token } = await supabase
      .from("hmrc_tokens")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (!token) {
      return res.status(401).json({ error: "No HMRC token found" });
    }

    let accessToken = token.access_token;

    // =========================
    // 2️⃣ REFRESH TOKEN
    // =========================
    const isExpired = new Date() >= new Date(token.expires_at);

    if (isExpired) {
      const refreshResponse = await fetch(`${HMRC_BASE}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: token.refresh_token,
          client_id: process.env.HMRC_CLIENT_ID,
          client_secret: process.env.HMRC_CLIENT_SECRET,
        }),
      });

      const newTokens = await refreshResponse.json();

      if (!refreshResponse.ok) {
        return res.status(401).json(newTokens);
      }

      const newExpiry = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

      await supabase
        .from("hmrc_tokens")
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at: newExpiry,
        })
        .eq("user_id", user_id);

      accessToken = newTokens.access_token;
    }

    // =========================
    // 3️⃣ FRAUD HEADERS
    // =========================
    const fraudHeaders = buildFraudHeaders(req, user_id);

    // =========================
    // 4️⃣ TEST HMRC CALL (SAFE)
    // =========================
    const url = `${HMRC_BASE}/individuals/self-assessment/obligations?from=2024-04-06&to=2025-04-05`;

    const hmrcResponse = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.hmrc.1.0+json",
        ...fraudHeaders,
      },
    });

    const data = await hmrcResponse.json();

    return res.status(200).json({
      success: true,
      message: "HMRC connection working",
      data,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
