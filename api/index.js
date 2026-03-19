import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY
);

// Test route
app.get("/", (req, res) => {
  res.send("Backend running ✅");
});

// HMRC callback
app.get("/auth/hmrc/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const response = await axios.post(
      "https://test-api.service.hmrc.gov.uk/oauth/token",
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

    await supabase.from("hmrc_tokens").upsert({
      user_id: "11111111-1111-1111-1111-111111111111",
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
      token_type: data.token_type,
    });

    res.send("HMRC connected successfully ✅");
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("Error connecting to HMRC");
  }
});

export default app;
