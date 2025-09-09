/**
 * server.js (Gemini-ready) - FIXED FOR RENDER
 * This version properly handles static files and all routing issues
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

// Middleware order is CRITICAL
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // increased limit
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Initialize Gemini
const geminiKey = process.env.GEMINI_API_KEY;
if (!geminiKey) {
  console.error("❌ GEMINI_API_KEY not found in environment variables!");
  console.log("Available env vars:", Object.keys(process.env).filter(k => k.includes('API') || k.includes('GEMINI')));
} else {
  console.log("✅ GEMINI_API_KEY found");
}

const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;
const model = genAI ? genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-1.5-flash" }) : null;

// Helper function
async function chatWithGemini(message, history = []) {
  if (!model) {
    throw new Error("Gemini API not configured - check GEMINI_API_KEY");
  }
  
  try {
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(message);
    
    if (result && result.response && typeof result.response.text === "function") {
      return result.response.text();
    }
    
    // Fallback parsing
    if (result && result.response) {
      return String(result.response);
    }
    
    return String(result);
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

// API Routes - MUST come before static files
app.post("/api/groq", async (req, res) => {
  console.log("📥 API request received:", req.body);
  
  try {
    const { message, action, payload } = req.body || {};
    
    let textToProcess = message;
    let responseFormat = "reply";
    
    // Handle action-based requests from frontend
    if (action && payload) {
      switch (action) {
        case "chat":
          textToProcess = payload.text;
          responseFormat = "reply";
          break;
        case "summarize":
          textToProcess = `Please provide a concise summary of the following text:\n\n${payload.text}`;
          responseFormat = "result";
          break;
        case "quiz":
          const count = payload.count || 5;
          textToProcess = `Create exactly ${count} multiple choice questions about "${payload.text}". For each question, provide:
1. The question
2. Four answer options (A, B, C, D)
3. The correct answer

Format each question clearly.`;
          responseFormat = "questions";
          break;
        default:
          console.log("❌ Unknown action:", action);
          return res.status(400).json({ error: "Unknown action: " + action });
      }
    }
    
    if (!textToProcess || textToProcess.trim().length === 0) {
      return res.status(400).json({ error: "No text provided to process" });
    }

    console.log("🤖 Processing with Gemini:", { action, textLength: textToProcess.length });
    
    const reply = await chatWithGemini(textToProcess);
    
    console.log("✅ Gemini response received, length:", reply.length);
    
    // Format response based on request type
    switch (responseFormat) {
      case "result":
        return res.json({ result: reply });
        
      case "questions":
        // Try to parse questions, but always return something
        try {
          const lines = reply.split('\n').filter(line => line.trim());
          const questions = [];
          let currentQ = null;
          
          for (const line of lines) {
            const trimmed = line.trim();
            if (/^\d+[\.\)]/.test(trimmed)) {
              if (currentQ) questions.push(currentQ);
              currentQ = { 
                question: trimmed.replace(/^\d+[\.\)]\s*/, ''), 
                options: [], 
                answer: '' 
              };
            } else if (/^[A-D][\.\)]/.test(trimmed) && currentQ) {
              currentQ.options.push(trimmed);
            } else if (trimmed.toLowerCase().includes('answer') && currentQ) {
              currentQ.answer = trimmed.replace(/.*answer:?\s*/i, '');
            }
          }
          if (currentQ) questions.push(currentQ);
          
          return res.json({ 
            questions: questions.length > 0 ? questions : [reply],
            quiz: questions.length > 0 ? questions : [reply],
            raw: reply // fallback
          });
        } catch (parseError) {
          console.log("⚠️ Quiz parsing failed, returning raw:", parseError.message);
          return res.json({ 
            questions: [reply], 
            quiz: [reply],
            raw: reply 
          });
        }
        
      default:
        return res.json({ reply });
    }
    
  } catch (error) {
    console.error("❌ API Error:", error);
    return res.status(500).json({ 
      error: error.message || "Server error occurred",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    gemini_configured: !!geminiKey,
    port: PORT
  });
});

// Test endpoint
app.get("/api/test", (req, res) => {
  res.json({ 
    message: "API is working!",
    gemini_key_present: !!geminiKey,
    env_vars: Object.keys(process.env).filter(k => k.includes('API') || k.includes('GEMINI'))
  });
});

// Static files - MUST come after API routes
console.log("📁 Setting up static files from:", path.join(__dirname, 'public'));
app.use(express.static(path.join(__dirname, 'public'), {
  dotfiles: 'ignore',
  etag: false,
  extensions: ['htm', 'html'],
  index: ['index.html'],
  maxAge: '1d',
  redirect: false,
  setHeaders: function (res, path, stat) {
    res.set('x-timestamp', Date.now());
  }
}));

// Catch-all handler for SPA - MUST be last
app.get('*', (req, res) => {
  console.log("🌐 Serving index.html for:", req.url);
  const indexPath = path.join(__dirname, 'public', 'index.html');
  
  // Check if index.html exists
  try {
    res.sendFile(indexPath);
  } catch (error) {
    console.error("❌ Could not serve index.html:", error);
    res.status(404).send(`
      <html>
        <body style="font-family: Arial; padding: 40px; text-align: center;">
          <h1>🚀 LittleAI Server Running</h1>
          <p>But index.html not found at: ${indexPath}</p>
          <p>Make sure your files are in the /public directory:</p>
          <ul style="text-align: left; display: inline-block;">
            <li>public/index.html</li>
            <li>public/style.css</li>
            <li>public/main.js</li>
          </ul>
          <hr>
          <p>API Status: <a href="/health">/health</a> | <a href="/api/test">/api/test</a></p>
        </body>
      </html>
    `);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 LittleAI Server Started!
📍 Port: ${PORT}
📁 Static files: ${path.join(__dirname, 'public')}
🔑 Gemini API: ${geminiKey ? '✅ Configured' : '❌ Missing'}
🌍 Environment: ${process.env.NODE_ENV || 'development'}

Test URLs:
- Health: http://localhost:${PORT}/health
- API Test: http://localhost:${PORT}/api/test
- App: http://localhost:${PORT}
  `);
});
