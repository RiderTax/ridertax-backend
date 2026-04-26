import crypto from "crypto";

export function buildFraudHeaders(req, userId) {
  const now = new Date().toISOString();

  return {
    // =============================
    // CLIENT HEADERS
    // =============================
    "gov-client-device-id": crypto.randomUUID(), // MUST be UUID
    "gov-client-user-ids": `userId=${userId}`,

    "gov-client-timezone": "UTC+00:00",

    "gov-client-local-ips": "127.0.0.1",
    "gov-client-local-ips-timestamp": now,

    "gov-client-public-ip": req.headers["x-forwarded-for"] || "8.8.8.8",
    "gov-client-public-ip-timestamp": now,
    "gov-client-public-port": "443",

    // MFA (STRICT FORMAT)
    "gov-client-multi-factor": "type=totp",

    // Screen info (STRICT FORMAT)
    "gov-client-screens": "width=1920&height=1080&colourDepth=24",

    // =============================
    // VENDOR HEADERS
    // =============================
    "gov-vendor-product-name": "RiderTax",
    "gov-vendor-version": "1.0.0",
    "gov-vendor-license-ids": "licenseId=RIDER123",

    // Network headers
    "gov-vendor-forwarded": `for=${req.headers["x-forwarded-for"] || "8.8.8.8"}`,
    "gov-vendor-public-ip": req.headers["x-forwarded-for"] || "8.8.8.8",

    // Optional (but recommended)
    "gov-client-user-agent": req.headers["user-agent"] || "RiderTaxApp",
  };
}
