export default async function handler(req, res) {
  const HMRC_AUTH_URL = "https://test-api.service.hmrc.gov.uk/oauth/authorize";

  const clientId = process.env.HMRC_CLIENT_ID;
  const redirectUri = process.env.HMRC_REDIRECT_URI;

  const scope = encodeURIComponent(
    "read:self-assessment read:individuals"
  );

  const state = Math.random().toString(36).substring(2);

  const url = `${HMRC_AUTH_URL}?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

  return res.redirect(url);
}
