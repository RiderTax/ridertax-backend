export default async function handler(req, res) {
  try {
    console.log("🚀 STATUS API HIT");

    return res.status(200).json({
      connected: false,
      connected_at: null,
      debug: "API working",
    });

  } catch (err) {
    console.error("💥 STATUS CRASH:", err);
    return res.status(500).json({ error: "crash" });
  }
}
