export default async function handler(req, res) {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).send("Missing user_id");
  }

  const authUrl =
    "https://test-api.service.hmrc.gov.uk/oauth/authorize?" +
    new URLSearchParams({
      response_type: "code",
      client_id: process.env.HMRC_CLIENT_ID,
      scope: "read:self-assessment read:individuals",
      redirect_uri: process.env.HMRC_REDIRECT_URI,
      state: user_id, // ✅ THIS IS CRITICAL
    });

  return res.redirect(authUrl);
}
