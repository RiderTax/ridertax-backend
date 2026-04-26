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
  const deviceId = hash(user_id);
  const publicIP = getPublicIP(req);
  const timestamp = new Date().toISOString();

  return {
    // ✅ CORE
    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",

    // ✅ STABLE IDs
    "Gov-Client-Device-ID": deviceId,
    "Gov-Client-User-IDs": `device=${deviceId}`,

    // ✅ NETWORK
    "Gov-Client-Public-IP": publicIP,
    "Gov-Client-Public-IP-Timestamp": timestamp,

    // ✅ SERVER SAFE MFA
    "Gov-Client-Multi-Factor":
      `type=OTHER&timestamp=${timestamp}&unique-reference=${deviceId}`,

    // ✅ MINIMAL DEVICE INFO
    "Gov-Client-Timezone": "UTC+05:30",

    // ✅ VENDOR
    "Gov-Vendor-Product-Name": "RiderTax",
    "Gov-Vendor-Version": "1.0.0",
    "Gov-Vendor-License-IDs": `licenseId=${hash("RiderTax")}`,
    "Gov-Vendor-Public-IP": publicIP,
  };
}
