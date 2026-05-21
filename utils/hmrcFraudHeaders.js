import crypto from "crypto";

export function buildFraudHeaders(req) {
  // =========================
  // CLIENT INFO
  // =========================
  const userAgent =
    req.headers["user-agent"] ||
    "unknown";

  const forwardedFor =
    req.headers["x-forwarded-for"];

  const publicIp =
    forwardedFor
      ? forwardedFor.split(",")[0].trim()
      : "0.0.0.0";

  // =========================
  // RANDOM DEVICE ID
  // =========================
  const deviceId =
    crypto.randomUUID();

  // =========================
  // OPTIONAL SCREEN INFO
  // =========================
  const screen =
    req.headers["x-screen-resolution"] ||
    "width=1920&height=1080&scaling-factor=1&colour-depth=24";

  const windowSize =
    req.headers["x-window-size"] ||
    "width=1920&height=1080";

  // =========================
  // FRAUD PREVENTION HEADERS
  // =========================
  return {
    "Gov-Client-Connection-Method":
      "WEB_APP_VIA_SERVER",

    "Gov-Client-Device-ID":
      deviceId,

    "Gov-Client-User-Agent":
      userAgent,

    "Gov-Client-Browser-JS-User-Agent":
      userAgent,

    "Gov-Client-Timezone":
      "Europe/London",

    "Gov-Client-Local-IPs":
      publicIp,

    "Gov-Client-Public-IP":
      publicIp,

    "Gov-Client-Public-Port":
      "443",

    "Gov-Client-Screens":
      screen,

    "Gov-Client-Window-Size":
      windowSize,

    "Gov-Client-Browser-Plugins":
      "none",

    "Gov-Client-MAC-Addresses":
      "02:00:00:00:00:00",

    "Gov-Vendor-Version":
      "RiderTax=2.0.0",

    "Gov-Vendor-License-IDs":
      "RiderTax=MTD",
  };
}
