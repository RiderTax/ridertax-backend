import crypto from "crypto";

// Generate a stable device ID per user
function generateDeviceId(user_id) {
  return crypto
    .createHash("sha256")
    .update(user_id)
    .digest("hex");
}

// Get public IP safely (Vercel compatible)
function getPublicIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket?.remoteAddress ||
    "127.0.0.1"
  );
}

export function buildFraudHeaders(req, user_id) {
  const deviceId = generateDeviceId(user_id);
  const publicIP = getPublicIP(req);

  return {
    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",

    "Gov-Client-Device-ID": deviceId,

    "Gov-Client-User-IDs": JSON.stringify({
      userId: user_id,
    }),

    "Gov-Client-Timezone": "UTC+05:30",

    "Gov-Client-Local-IPs": "127.0.0.1",

    "Gov-Client-Public-IP": publicIP,

    "Gov-Client-Public-Port": "443",

    "Gov-Client-Screens": "width=1920&height=1080",

    "Gov-Client-Window-Size": "width=1200&height=800",

    "Gov-Client-Browser-JS-User-Agent":
      req.headers["user-agent"] || "unknown",

    "Gov-Client-Browser-Do-Not-Track": "false",

    "Gov-Client-Multi-Factor": "type=none",

    "Gov-Client-Local-IPs-Timestamp": new Date().toISOString(),

    "Gov-Vendor-Version": "RiderTax=1.0.0",

    "Gov-Vendor-License-IDs": "RiderTax",

    "Gov-Vendor-Public-IP": publicIP,

    "Gov-Vendor-Forwarded": `by=${publicIP}&for=${publicIP}`,

    "Gov-Client-MAC-Addresses": "00:00:5e:00:53:af",
  };
}
