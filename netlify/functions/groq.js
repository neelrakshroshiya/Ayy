/**
 * netlify/functions/groq.js -> Replaced to use Gemini
 * This serverless function mirrors the previous behavior but uses Gemini via environment variable.
 * Deploy to Netlify as-is. Ensure NETLIFY_GEMINI_API_KEY (or GEMINI_API_KEY) is set in Netlify env vars.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const geminiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(geminiKey);
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });

export const handler = async (event, context) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const message = body.message || body.prompt || "";
    if (!message) return { statusCode: 400, body: JSON.stringify({ error: "Message is required" }) };

    const chat = model.startChat({ history: [] });
    const result = await chat.sendMessage(message);
    let reply = "";
    if (result && result.response && typeof result.response.text === "function") {
      reply = result.response.text();
    } else {
      reply = JSON.stringify(result);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ reply }),
      headers: { "Content-Type": "application/json" },
    };
  } catch (err) {
    console.error("Netlify Gemini function error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Server error" }) };
  }
};