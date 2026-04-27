export default async function handler(req, res) {
  try {
    // ✅ FIXED ROUTING (handles all cases properly)
    const route = req.query.route;
    const path = Array.isArray(route)
      ? "/" + route.join("/")
      : route
      ? "/" + route
      : "/";

    console.log("👉 HMRC ROUTE:", path);

    // ROOT
    if (path === "/" || path === "") {
      return res.status(200).send("HMRC API Root Working ✅");
    }

    // LOGS (UNCHANGED)
    if (path === "/logs") {
      return res.status(200).json({
        logs: [],
      });
    }

    // SUBMIT (UNCHANGED)
    if (path === "/submit") {
      return res.status(200).json({
        success: true,
        message: "Submit endpoint working ✅",
      });
    }

    // VALIDATE HEADERS (UNCHANGED LOGIC)
    if (path === "/validate-headers") {
      const headers = {
        "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
        "Gov-Client-User-Agent": req.headers["user-agent"] || "unknown",
        "Gov-Client-Public-IP":
          req.headers["x-forwarded-for"]?.split(",")[0] || "127.0.0.1",
        "Gov-Client-Timezone": "UTC",
        "Gov-Vendor-Product-Name": "RiderTax",
        "Gov-Vendor-Version": "1.0.0",
      };

      return res.status(200).json({
        success: true,
        message: "Headers generated successfully ✅",
        headers,
      });
    }

    // FALLBACK
    return res.status(404).send("Route not found");

  } catch (error) {
    console.error("❌ HMRC ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
