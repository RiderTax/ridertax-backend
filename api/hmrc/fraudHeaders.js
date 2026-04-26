export function buildFraudHeaders(req, userId) {
  return {
    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
    "Gov-Client-Device-ID": userId,
    "Gov-Client-User-IDs": `user=${userId}`,
    "Gov-Client-Timezone": "UTC+00:00",
    "Gov-Client-Local-IPs": req.headers["x-forwarded-for"] || "127.0.0.1",
    "Gov-Client-Screens": "width=1920&height=1080",
    "Gov-Client-Window-Size": "width=1200&height=800",
    "Gov-Client-Browser-Plugins": "none",
    "Gov-Client-Browser-JS-User-Agent": req.headers["user-agent"] || "unknown",
    "Gov-Client-Browser-Do-Not-Track": "false",
    "Gov-Client-Multi-Factor": "type=none",
    "Gov-Vendor-Version": "ridertax=1.0.0",
    "Gov-Vendor-License-IDs": "ridertax-license",
    "Gov-Client-Public-IP": req.headers["x-forwarded-for"] || "127.0.0.1",
  };
}
