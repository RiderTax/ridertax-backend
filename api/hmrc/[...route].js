export default async function handler(req, res) {
  try {
    const route = req.query.route || []
    const path = "/" + route.join("/")

    console.log("👉 HMRC ROUTE:", path)

    // ROOT
    if (path === "/" || path === "") {
      return res.status(200).send("HMRC API Root Working ✅")
    }

    // LOGS
    if (path === "/logs") {
      return res.status(200).json({ logs: [] })
    }

    // SUBMIT
    if (path === "/submit") {
      return res.status(200).json({
        success: true,
        message: "Submit endpoint working ✅"
      })
    }

    // VALIDATE HEADERS
    if (path === "/validate-headers") {
      return res.status(200).json({
        success: false,
        error: {
          code: "MATCHING_RESOURCE_NOT_FOUND",
          message: "A resource with the name in the request can not be found in the API"
        }
      })
    }

    // FALLBACK
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
