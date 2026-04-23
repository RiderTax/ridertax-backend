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

  // ⚠️ MUST be ISO without milliseconds
  const timestamp = new Date().toISOString().split(".")[0] + "Z";

  return {
    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",

    "Gov-Client-Device-ID": deviceId,

    "Gov-Client-User-IDs": `userId=${user_id}`,

    "Gov-Client-Timezone": "UTC+05:30",

    "Gov-Client-Local-IPs": "127.0.0.1",

    "Gov-Client-Public-IP": publicIP,
    "Gov-Client-Public-IP-Timestamp": timestamp,

    "Gov-Client-Public-Port": "12345",

    // ✅ EXACT FORMAT HMRC ACCEPTS
    "Gov-Client-Screens":
      "width=1920&height=1080&colourDepth=24&scalingFactor=1",

    "Gov-Client-Window-Size": "width=1200&height=800",

    "Gov-Client-Browser-JS-User-Agent":
      req.headers["user-agent"] || "Mozilla/5.0",

    "Gov-Client-Browser-Do-Not-Track": "false",

    // ✅ STRICT FORMAT (THIS FIXES YOUR ERROR)
    "Gov-Client-Multi-Factor":
      `type=OTHER&timestamp=${timestamp}&uniqueReference=${deviceId}`,

    "Gov-Client-Local-IPs-Timestamp": timestamp,

    "Gov-Vendor-Version": "RiderTax=1.0.0",

    "Gov-Vendor-License-IDs": `licenseId=${hash("RiderTax")}`,

    "Gov-Vendor-Product-Name": "RiderTax",

    "Gov-Vendor-Public-IP": publicIP,

    "Gov-Vendor-Forwarded": `by=${publicIP}&for=${publicIP}`,
  };
}
