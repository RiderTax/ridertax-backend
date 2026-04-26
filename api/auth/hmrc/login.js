export default async function handler(req, res) {
  const HMRC_AUTH_URL = "https://test-api.service.hmrc.gov.uk/oauth/authorize";

  const clientId = process.env.HMRC_CLIENT_ID;
  const redirectUri = process.env.HMRC_REDIRECT_URI;

  const user_id = req.query.user_id; // 👈 IMPORTANT

  if (!user_id) {
    return res.status(400).send("Missing user_id");
  }

  const scope = encodeURIComponent(
    "read:self-assessment read:individuals"
  );

  // 👇 THIS IS THE FIX
  const state = user_id;

  const url = `${HMRC_AUTH_URL}?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

  return res.redirect(url);
}
