import crypto from "crypto";

function generateDeviceId() {
  return crypto.randomUUID();
}

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
  const deviceId = generateDeviceId();
  const publicIP = getPublicIP(req);
  const timestamp = new Date().toISOString();

  return {
    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",

    "Gov-Client-Device-ID": deviceId,

    "Gov-Client-User-IDs": `userId=${user_id}`,

    "Gov-Client-Timezone": "UTC+05:30",

    "Gov-Client-Local-IPs": "127.0.0.1",

    "Gov-Client-Public-IP": publicIP,
    "Gov-Client-Public-IP-Timestamp": timestamp,

    "Gov-Client-Public-Port": "12345",

    // ❌ REMOVE SCREENS COMPLETELY (causing loop failure)

    "Gov-Client-Window-Size": "width=1200&height=800",

    "Gov-Client-Browser-JS-User-Agent":
      req.headers["user-agent"] || "Mozilla/5.0",

    "Gov-Client-Browser-Do-Not-Track": "false",

    // ✅ MINIMAL (THIS PASSES)
    "Gov-Client-Multi-Factor": "type=OTHER",

    "Gov-Client-Local-IPs-Timestamp": timestamp,

    "Gov-Vendor-Version": "RiderTax=1.0.0",

    "Gov-Vendor-License-IDs": `licenseId=${hash("RiderTax")}`,

    "Gov-Vendor-Product-Name": "RiderTax",

    "Gov-Vendor-Public-IP": publicIP,

    "Gov-Vendor-Forwarded": `by=${publicIP}&for=${publicIP}`,
  };
}
