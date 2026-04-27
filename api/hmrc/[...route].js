export default async function handler(req, res) {
  try {
    const path = req.query.route ? "/" + req.query.route.join("/") : "/";

    console.log("👉 HMRC ROUTE:", path);

    // ROOT
    if (path === "/" || path === "") {
      return res.status(200).send("HMRC API Root Working ✅");
    }

    // LOGS
    if (path === "/logs") {
      return res.status(200).json({
        logs: [],
      });
    }

    // SUBMIT (TEST)
    if (path === "/submit") {
      return res.status(200).json({
        success: true,
        message: "Submit endpoint working ✅",
      });
    }

    // VALIDATE HEADERS (NO HMRC CALL - LOCAL ONLY)
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
