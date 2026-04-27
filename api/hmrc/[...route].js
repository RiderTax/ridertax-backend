export default async function handler(req, res) {
  try {
    // Normalize route properly
    let route = req.query.route

    if (!route) {
      route = []
    }

    if (!Array.isArray(route)) {
      route = [route]
    }

    const path = "/" + route.join("/")

    console.log("👉 HMRC ROUTE:", path)

    // ROOT → /api/hmrc
    if (route.length === 0) {
      return res.status(200).send("HMRC API Root Working ✅")
    }

    // /logs
    if (path === "/logs") {
      return res.status(200).json({ logs: [] })
    }

    // /submit
    if (path === "/submit") {
      return res.status(200).json({
        success: true,
        message: "Submit endpoint working ✅"
      })
    }

    // /validate-headers
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

    // fallback
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
