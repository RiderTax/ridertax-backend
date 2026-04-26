import crypto from "crypto";

export function buildFraudHeaders(req, userId) {
  const ip =
    (req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() || "8.8.8.8";

  return {
    "gov-client-connection-method": "WEB_APP_VIA_SERVER",

    "gov-client-device-id": crypto.randomUUID(),

    "gov-client-user-ids": `userId=${userId}`,

    "gov-client-public-ip": ip,

    "gov-client-user-agent":
      req.headers["user-agent"] || "RiderTaxApp",

    "gov-vendor-product-name": "RiderTax",
  };
}
