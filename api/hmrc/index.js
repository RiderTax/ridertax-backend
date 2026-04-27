export default function handler(req, res) {
  const { url } = req;

  // Allow only root
  if (url === "/api/hmrc" || url === "/api/hmrc/") {
    return res.status(200).send("HMRC API Root Working ✅");
  }

  // Anything else → force 404 so [...route] handles it
  return res.status(404).json({
    error: "Route not handled by index.js"
  });
}
