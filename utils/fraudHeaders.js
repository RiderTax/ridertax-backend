import crypto from "crypto";

export function buildFraudHeaders(req) {
  return {
    "Gov-Client-Connection-Method":
      "WEB_APP_VIA_SERVER",

    "Gov-Client-Device-ID":
      crypto.randomUUID(),

    "Gov-Client-User-Agent":
      req.headers["user-agent"] || "unknown",

    "Gov-Client-Timezone":
      "Europe/London",

    "Gov-Client-Local-IPs":
      "127.0.0.1",

    "Gov-Client-Screens":
      "width=1920&height=1080&scaling-factor=1&colour-depth=24",

    "Gov-Client-Window-Size":
      "width=1920&height=1080",

    "Gov-Client-Browser-Plugins":
      "none",

    "Gov-Client-Browser-JS-User-Agent":
      req.headers["user-agent"] || "unknown",

    "Gov-Client-Public-Port":
      "443",

    "Gov-Client-Public-IP":
      req.headers["x-forwarded-for"] || "127.0.0.1",

    "Gov-Vendor-Version":
      "RiderTax=2.0.0",

    "Gov-Vendor-License-IDs":
      "RiderTax=MTD",

    "Gov-Client-MAC-Addresses":
      "00:00:5e:00:53:af"
  };
}
