export const config = {
  runtime: "nodejs",
};

import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Router (important for Vercel)
const router = express.Router();

// ✅ Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ===============================
// ✅ ROOT
// ===============================
router.get("/", (req, res) => {
  res.send("HMRC API Root Working ✅");
});

// ===============================
// 🔐 CALLBACK
// ===============================
router.get("/auth/hmrc/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!state) {
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
        code,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const token = response.data;

    await supabase.from("hmrc_tokens").upsert({
      user_id: state,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: new Date(Date.now() + token.expires_in * 1000),
      scope: token.scope,
      token_type: token.token_type,
    });

    res.send("HMRC connected successfully ✅");
  } catch (err) {
    console.error("CALLBACK ERROR:", err.response?.data || err.message);
    res.status(500).send("HMRC connection failed");
  }
});

// ===============================
// 🔄 REFRESH TOKEN
// ===============================
router.get("/refresh/:userId", async (req, res) => {
  const { userId } = req.params;

  const { data } = await supabase
    .from("hmrc_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!data) return res.status(404).send("User not found");

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

    const token = response.data;

    await supabase.from("hmrc_tokens").upsert({
      user_id: userId,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: new Date(Date.now() + token.expires_in * 1000),
      scope: token.scope,
      token_type: token.token_type,
    });

    res.send("Token refreshed ✅");
  } catch (err) {
    console.error("REFRESH ERROR:", err.response?.data || err.message);
    res.status(500).send("Refresh failed");
  }
});

// ===============================
// 🛡️ FRAUD HEADER VALIDATION
// ===============================
router.get("/validate-headers", async (req, res) => {
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
  } catch (err) {
    console.error("VALIDATION ERROR:", err.response?.data || err.message);

    res.status(400).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
});

// ===============================
// 🔥 IMPORTANT FIX (NO DUPLICATION)
// ===============================
app.use("/", router);

// ===============================
// ✅ EXPORT FOR VERCEL
// ===============================
export default (req, res) => app(req, res);