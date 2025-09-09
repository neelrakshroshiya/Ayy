/**
 * server.js (Gemini-ready)
 * Replace your existing server.js in the repo with this file.
 * Uses process.env.GEMINI_API_KEY (no hardcoded keys).
 */

import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Basic in-memory rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 60, // limit each IP to 60 requests per windowMs
});
app.use(limiter);

// Profanity filter
const PROFANITY = ["badword1", "badword2"];

// Initialize Gemini client
const geminiKey = process.env.GEMINI_API_KEY;
if (!geminiKey) {
  console.warn("Warning: GEMINI_API_KEY not set. Set it in Render environment variables.");
}
const genAI = new GoogleGenerativeAI(geminiKey);
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });

// Helper: call Gemini chat and return text
async function chatWithGemini(message, history = []) {
  try {
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(message);
    if (result && result.response && typeof result.response.text === "function") {
      return result.response.text();
    }
    return String(result);
  } catch (error) {
    console.error("Gemini API error:", error);
    throw error;
  }
}

// Updated API endpoint to handle both old and new request formats
app.post("/api/groq", async (req, res) => {
  try {
    const { message, action, payload } = req.body || {};
    
    let textToProcess = message;
    let responseFormat = "reply";
    
    // Handle new action-based format from frontend
    if (action && payload) {
      switch (action) {
        case "chat":
          textToProcess = payload.text;
          responseFormat = "reply";
          break;
        case "summarize":
          textToProcess = `Please summarize the following text concisely:\n\n${payload.text}`;
          responseFormat = "result";
          break;
        case "quiz":
          const count = payload.count || 5;
          textToProcess = `Create ${count} multiple choice questions about "${payload.text}". Format each question with the question text, 4 answer options (A, B, C, D), and indicate the correct answer.`;
          responseFormat = "questions";
          break;
        default:
          return res.status(400).json({ error: "Unknown action" });
      }
    }
    
    if (!textToProcess) {
      return res.status(400).json({ error: "Message or payload required" });
    }

    // Basic profanity check
    const lower = textToProcess.toLowerCase();
    for (const p of PROFANITY) {
      if (lower.includes(p)) {
        return res.status(400).json({ error: "Profanity not allowed" });
      }
    }

    const reply = await chatWithGemini(textToProcess);
    
    // Format response based on action type
    if (responseFormat === "result") {
      return res.json({ result: reply });
    } else if (responseFormat === "questions") {
      // Try to parse quiz questions if possible
      try {
        const questions = [];
        const lines = reply.split('\n').filter(line => line.trim());
        let currentQuestion = null;
        
        for (const line of lines) {
          if (line.match(/^\d+\./)) {
            if (currentQuestion) questions.push(currentQuestion);
            currentQuestion = { question: line.replace(/^\d+\.\s*/, ''), options: [], answer: '' };
          } else if (line.match(/^[A-D]\)/)) {
            if (currentQuestion) currentQuestion.options.push(line);
          } else if (line.toLowerCase().includes('answer:')) {
            if (currentQuestion) currentQuestion.answer = line.replace(/.*answer:\s*/i, '');
          }
        }
        if (currentQuestion) questions.push(currentQuestion);
        
        return res.json({ 
          questions: questions.length > 0 ? questions : [reply],
          quiz: questions.length > 0 ? questions : [reply]
        });
      } catch (parseError) {
        return res.json({ questions: [reply], quiz: [reply] });
      }
    } else {
      return res.json({ reply });
    }
  } catch (err) {
    console.error("Gemini error:", err);
    return res.status(500).json({ error: "AI backend error" });
  }
});

// Serve index.html for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Serving static files from: ${path.join(__dirname, 'public')}`);
});
