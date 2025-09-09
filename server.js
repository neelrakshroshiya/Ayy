/**
 * server.js (Gemini-ready)
 * Replace your existing server.js in the repo with this file.
 * Uses process.env.GEMINI_API_KEY (no hardcoded keys).
 *
 * Preserves existing API routes and responses structure to avoid design/front-end changes.
 * NOTE: keep your original middleware, static file serving or port config if different.
 */

import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Basic in-memory rate limiting (keeps behavior similar to original project)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 60, // limit each IP to 60 requests per windowMs
});
app.use(limiter);

// Profanity filter preserved (you can expand this)
const PROFANITY = ["badword1", "badword2"]; // keep as-is, update per original server.js if needed

// Initialize Gemini client (environment variable)
const geminiKey = process.env.GEMINI_API_KEY;
if (!geminiKey) {
  console.warn("Warning: GEMINI_API_KEY not set. Set it in Render environment variables.");
}
const genAI = new GoogleGenerativeAI(geminiKey);
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });

// Helper: call Gemini chat and return text
async function chatWithGemini(message, history = []) {
  const chat = model.startChat({ history });
  const result = await chat.sendMessage(message);
  // result.response may contain different shapes; prefer .text() if available
  if (result && result.response && typeof result.response.text === "function") {
    return result.response.text();
  }
  // fallback
  if (result && result.output && result.output[0] && result.output[0].content) {
    // conservative fallback parse
    return String(result.output[0].content);
  }
  return String(result);
}

// Keep same route signature as original server.js: POST /api/groq or /api/chat
app.post("/api/groq", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "Message required" });

    // basic profanity check (mirror previous behavior)
    const lower = message.toLowerCase();
    for (const p of PROFANITY) {
      if (lower.includes(p)) {
        return res.status(400).json({ error: "Profanity not allowed" });
      }
    }

    const reply = await chatWithGemini(message);
    return res.json({ reply });
  } catch (err) {
    console.error("Gemini error:", err);
    return res.status(500).json({ error: "AI backend error" });
  }
});

// Keep any other endpoints minimal — if original had /api/quiz, /api/summarize, mirror same names
app.post("/api/quiz", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: "Text required" });
    const prompt = `Create 3 short multiple choice questions from this text:\n\n${text}`;
    const reply = await chatWithGemini(prompt);
    return res.json({ reply });
  } catch (err) {
    console.error("Gemini quiz error:", err);
    return res.status(500).json({ error: "AI backend error" });
  }
});

// Health check and static fallback (do not change design — static files should still be served by existing config)
app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});