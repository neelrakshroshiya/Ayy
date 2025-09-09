Gemini patch for heheai
======================

Files included:
- server.js -> Replace your repo's server.js (Render backend) with this Gemini-compatible server.
- netlify/functions/groq.js -> Replace existing Netlify function file to use Gemini.

Notes & steps to integrate (don't change frontend design):
1. Copy files into your repository, replacing the corresponding backend files only.
2. In Render (Web Service) set an environment variable: GEMINI_API_KEY with your API key.
   - Optionally set GEMINI_MODEL (e.g., gemini-1.5-flash or gemini-1.5-pro)
3. For Netlify functions set either GROQ_API_KEY or GEMINI_API_KEY in Netlify env vars.
4. Install the Gemini client in your project:
   npm install @google/generative-ai
5. Deploy (Render/Netlify will pick up changes). Frontend design and routes preserved.
6. If your repo uses 'openai' package elsewhere, you can remove or keep it; these files do not require it.

If you want, I can prepare a PR patch file instead of manual replacement.