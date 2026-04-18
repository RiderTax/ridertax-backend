import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import serverless from "serverless-http";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Health check
app.get("/", (req, res) => {
  res.send("Backend running ✅");
});

// ===============================
// 🔐 HMRC CALLBACK (LOGIN)
// ===============================
app.get("/auth/hmrc/callback", async (req, res) => {
  const { code, state } = req.query;

  const userId = state;

  if (!userId) {
    return res.status(400).send("Missing user context");
  }

  try {
    const response = await axios.post(
      `${process.env.HMRC_BASE_URL}/oauth/token`,
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.HMRC_CLIENT_ID,
        client_secret: process.env.HMRC_CLIENT_SECRET,
        redirect_uri: process.env.HMRC_REDIRECT_URI,
        code: code,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const data = response.data;

    const { data: saved, error } = await supabase
      .from("hmrc_tokens")
      .upsert({
        user_id: userId,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000),
        scope: data.scope,
        token_type: data.token_type,
      });

    console.log("✅ Saved:", saved);
    console.log("❌ Error:", error);

    res.send("HMRC connected successfully ✅");
  } catch (error) {
    console.error("HMRC ERROR:", error.response?.data || error.message);
    res.status(500).send("Error connecting to HMRC");
  }
});

// ===============================
// 🔄 REFRESH TOKEN
// ===============================
app.get("/hmrc/refresh/:userId", async (req, res) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from("hmrc_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return res.status(404).send("User not found");
  }

  try {
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

    const newData = response.data;

    const { data: saved, error: saveError } = await supabase
      .from("hmrc_tokens")
      .upsert({
        user_id: userId,
        access_token: newData.access_token,
        refresh_token: newData.refresh_token,
        expires_at: new Date(Date.now() + newData.expires_in * 1000),
        scope: newData.scope,
        token_type: newData.token_type,
      });

    console.log("🔄 Refresh Saved:", saved);
    console.log("❌ Refresh Error:", saveError);

    res.send("Token refreshed ✅");
  } catch (err) {
    console.error("REFRESH ERROR:", err.response?.data || err.message);
    res.status(500).send("Refresh failed");
  }
});

// ===============================
// 🛡️ HMRC FRAUD HEADER VALIDATION
// ===============================
app.get("/hmrc/validate-headers", async (req, res) => {
  try {
    const fraudHeaders = {
      "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
      "Gov-Client-User-Agent": req.headers["user-agent"] || "unknown",
      "Gov-Client-Public-IP":
        req.headers["x-forwarded-for"]?.split(",")[0] || "127.0.0.1",
      "Gov-Client-Timezone": "UTC",
      "Gov-Vendor-Product-Name": "RiderTax",
      "Gov-Vendor-Version": "1.0.0",
    };

    const response = await axios.post(
      `${process.env.HMRC_BASE_URL}/test/fraud-prevention-headers/validate`,
      {},
      { headers: fraudHeaders }
    );

    res.json({
      success: true,
      hmrc_response: response.data,
    });
  } catch (error) {
    console.error(
      "VALIDATION ERROR:",
      error.response?.data || error.message
    );

    res.status(400).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
});

// ===============================
// 🚀 EXPORT FOR VERCEL
// ===============================
export default serverless(app);