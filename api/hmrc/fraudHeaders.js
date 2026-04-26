import crypto from "crypto";

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function getPublicIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket?.remoteAddress ||
    "127.0.0.1"
  );
}

export function buildFraudHeaders(req, user_id) {
  // ✅ STABLE device ID (CRITICAL FIX)
  const deviceId = hash(user_id);

  const publicIP = getPublicIP(req);
  const timestamp = new Date().toISOString();

  return {
    // ✅ REQUIRED
    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",

    // ✅ STABLE IDENTIFIERS
    "Gov-Client-Device-ID": deviceId,
    "Gov-Client-User-IDs": `device=${deviceId}`,

    // ✅ NETWORK INFO
    "Gov-Client-Public-IP": publicIP,
    "Gov-Client-Public-IP-Timestamp": timestamp,
    "Gov-Client-Local-IPs": "127.0.0.1",
    "Gov-Client-Local-IPs-Timestamp": timestamp,
    "Gov-Client-Public-Port": "12345",

    // ✅ DEVICE INFO
    "Gov-Client-Timezone": "UTC+05:30",
    "Gov-Client-Window-Size": "width=1200&height=800",

    // ✅ SCREENS (VALID FORMAT — YOU FIXED THIS 👍)
    "Gov-Client-Screens":
      "width=1920&height=1080&colour-depth=24&scaling-factor=1",

    // ✅ BROWSER INFO
    "Gov-Client-Browser-JS-User-Agent":
      req.headers["user-agent"] || "Mozilla/5.0",
    "Gov-Client-Browser-Do-Not-Track": "false",

    // ✅ MFA (ENCODED CORRECTLY)
    "Gov-Client-Multi-Factor":
      `type=OTHER&timestamp=${encodeURIComponent(timestamp)}&unique-reference=${encodeURIComponent(deviceId)}`,

    // ✅ VENDOR INFO
    "Gov-Vendor-Product-Name": "RiderTax",
    "Gov-Vendor-Version": "RiderTax=1.0.0",
    "Gov-Vendor-License-IDs": `licenseId=${hash("RiderTax")}`,
    "Gov-Vendor-Public-IP": publicIP,
    "Gov-Vendor-Forwarded": `by=${publicIP}&for=${publicIP}`,
  };
}
