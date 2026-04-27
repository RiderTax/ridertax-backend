export const config = {
  runtime: "nodejs",
};

import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // ✅ ALWAYS RELIABLE (do NOT use req.query)
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname.replace("/api/hmrc", "");

    console.log("👉 PATH:", path);

    // ===============================
    // ✅ ROOT
    // ===============================
    if (path === "" || path === "/") {
      return res.status(200).send("HMRC API Root Working ✅");
    }

    // ===============================
    // 🛡️ VALIDATE HEADERS
    // ===============================
    if (path === "/validate-headers") {
      try {
        const fraudHeaders = {
          "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
          "Gov-Client-User-Agent": req.headers["user-agent"] || "unknown",
          "Gov-Client-Public-IP":
            req.headers["x-forwarded-for"]?.split(",")[0] || "127.0.0.1",
          "Gov-Client-Timezone": "UTC",
          "Gov-Vendor-Product-Name": "RiderTax",
          "Gov-Vendor-Version": "1.0.0",
          "Accept": "application/vnd.hmrc.1.0+json",
          "Content-Type": "application/json",
        };

        const response = await axios.post(
          `${process.env.HMRC_BASE_URL}/test/fraud-prevention-headers/validate`,
          {},
          { headers: fraudHeaders }
        );

        return res.status(200).json({
          success: true,
          hmrc_response: response.data,
        });
      } catch (err) {
        console.error("❌ FRAUD ERROR:", err.response?.data || err.message);
        return res.status(400).json({
          success: false,
          error: err.response?.data || err.message,
        });
      }
    }

    // ===============================
    // 📜 LOGS
    // ===============================
    if (path === "/logs") {
      const { data, error } = await supabase
        .from("hmrc_logs")
        .select("*")
        .limit(50)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ LOG ERROR:", error);
        return res.status(200).json({ logs: [] });
      }

      return res.status(200).json({ logs: data || [] });
    }

    // ===============================
    // 🔄 REFRESH
    // ===============================
    if (path.startsWith("/refresh")) {
      const userId = path.split("/").pop();

      const { data } = await supabase
        .from("hmrc_tokens")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!data) return res.status(404).send("User not found");

      const response = await axios.post(
        `${process.env.HMRC_BASE_URL}/oauth/token`,
        new URLSearchParams({
          grant_type: "refresh_token",
          client_id: process.env.HMRC_CLIENT_ID,
          client_secret: process.env.HMRC_CLIENT_SECRET,
          refresh_token: data.refresh_token,
        }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      const token = response.data;

      await supabase.from("hmrc_tokens").upsert({
        user_id: userId,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: new Date(Date.now() + token.expires_in * 1000),
      });

      return res.status(200).send("Token refreshed ✅");
    }

    // ===============================
    // 🚀 SUBMIT
    // ===============================
    if (path === "/submit") {
      return res.status(200).json({
        success: true,
        message: "Submit endpoint working ✅",
      });
    }

    // ===============================
    // ❌ FALLBACK
    // ===============================
    return res.status(404).send("Route not found");

  } catch (err) {
    console.error("💥 HMRC ERROR:", err.message);
    return res.status(500).send("Internal server error");
  }
}
