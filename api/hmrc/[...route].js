export default async function handler(req, res) {
  try {
    // Get route from catch-all
    const route = req.query.route || []
    const path = "/" + route.join("/")

    console.log("👉 HMRC ROUTE:", path)

    // ROOT → /api/hmrc
    if (path === "/" || path === "") {
      return res.status(200).send("HMRC API Root Working ✅")
    }

    // /api/hmrc/logs
    if (path === "/logs") {
      return res.status(200).json({
        logs: []
      })
    }

    // /api/hmrc/submit
    if (path === "/submit") {
      return res.status(200).json({
        success: true,
        message: "Submit endpoint working ✅"
      })
    }

    // /api/hmrc/validate-headers
    if (path === "/validate-headers") {
      return res.status(200).json({
        success: false,
        error: {
          code: "MATCHING_RESOURCE_NOT_FOUND",
          message:
            "A resource with the name in the request can not be found in the API"
        }
      })
    }

    // Fallback
    return res.status(404).json({
      error: "Route not found",
      path
    })

  } catch (error) {
    console.error("❌ ERROR:", error)

    return res.status(500).json({
      error: "Internal server error",
      details: error.message
    })
  }
}
