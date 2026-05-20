export function applyCors(req, res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    process.env.FRONTEND_URL
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }

  return false;
}
