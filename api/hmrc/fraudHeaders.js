import crypto from "crypto";

export function buildFraudHeaders(req, userId) {
  const now = new Date().toISOString();

  const ip = req.headers["x-forwarded-for"] || "8.8.8.8";

  return {
    // =============================
    // CLIENT HEADERS
    // =============================
    "gov-client-connection-method": "WEB_APP", // ✅ FIX

    "gov-client-device-id": crypto.randomUUID(),
    "gov-client-user-ids": `userId=${userId}`,

    "gov-client-timezone": "UTC+00:00",

    "gov-client-local-ips": "127.0.0.1",
    "gov-client-local-ips-timestamp": now,

    "gov-client-public-ip": ip,
    "gov-client-public-ip-timestamp": now,
    "gov-client-public-port": "443",

    "gov-client-multi-factor": "type=totp",

    "gov-client-screens": "width=1920&height=1080&colourDepth=24",

    // =============================
    // VENDOR HEADERS
    // =============================
    "gov-vendor-product-name": "RiderTax",
    "gov-vendor-version": "1.0.0",
    "gov-vendor-license-ids": "licenseId=RIDER123",

    "gov-vendor-forwarded": `for=${ip}`,
    "gov-vendor-public-ip": ip,

    // OPTIONAL
    "gov-client-user-agent": req.headers["user-agent"] || "RiderTaxApp",
  };
}
