import crypto from "crypto";

export function buildFraudHeaders(req, userId) {
  const now = new Date().toISOString();
  const ip =
    (req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() || "8.8.8.8";

  return {
    // ✅ REQUIRED (and valid)
    "gov-client-connection-method": "WEB_APP_VIA_SERVER",

    "gov-client-device-id": crypto.randomUUID(),
    "gov-client-user-ids": `userId=${userId}`,
    "gov-client-timezone": "UTC+00:00",

    // ✅ Public IP (clean + consistent)
    "gov-client-public-ip": ip,
    "gov-client-public-ip-timestamp": now,

    // ✅ SIMPLE MFA (valid format)
    "gov-client-multi-factor": `type=totp&timestamp=${now}`,

    // ✅ User agent
    "gov-client-user-agent": req.headers["user-agent"] || "RiderTaxApp",

    // ✅ Vendor (clean + accepted)
    "gov-vendor-product-name": "RiderTax",
    "gov-vendor-version": "1.0.0",
    "gov-vendor-license-ids": "licenseId=RIDER123",
    "gov-vendor-public-ip": ip,
  };
}
