export function applyCors(req, res) {

  // =========================
  // ALLOWED ORIGINS
  // =========================
  const allowedOrigins = [
    "https://ridertax.co.uk",
    "https://www.ridertax.co.uk",
    "http://localhost:3000",
  ];

  const origin = req.headers.origin;

  // =========================
  // SET ORIGIN
  // =========================
  if (
    origin &&
    allowedOrigins.includes(origin)
  ) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );
  } else {
    // fallback
    res.setHeader(
      "Access-Control-Allow-Origin",
      "https://ridertax.co.uk"
    );
  }

  // =========================
  // CORS HEADERS
  // =========================
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,DELETE,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  res.setHeader(
    "Access-Control-Allow-Credentials",
    "true"
  );

  // =========================
  // PREFLIGHT
  // =========================
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  return false;
}
