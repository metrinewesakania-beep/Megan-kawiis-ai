// server.js
// Express server for Megan Kawiis AI
// Uses official OpenAI Node SDK. Keep API key in environment variables.

import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(helmet());
// Limit JSON body size to avoid very large requests
app.use(express.json({ limit: "64kb" }));

// Global rate limiting to prevent abuse
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.GLOBAL_RATE_LIMIT || "120", 10),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Serve only the public/ folder for static assets to avoid exposing repository files
app.use(express.static(path.join(__dirname, "public")));

// Keep API keys strictly on the server. Support either AI_API_KEY or OPENAI_API_KEY env var.
const API_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.warn("AI API key not found. /api endpoints will return setup guidance until configured.");
}

let openai = null;
if (API_KEY) {
  openai = new OpenAI({ apiKey: API_KEY });
}

const DEFAULT_MODEL = process.env.AI_MODEL || "gpt-4o-mini";

// Per-endpoint limiter for /api/chat
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.CHAT_RATE_LIMIT || "30", 10),
  standardHeaders: true,
  legacyHeaders: false,
});

function validateMessagesFromClient(messages) {
  if (!Array.isArray(messages)) return "messages must be an array";
  if (messages.length === 0) return "messages is empty";
  if (messages.length > 40) return "messages too long";

  for (const message of messages) {
    if (!message || typeof message !== "object") return "each message must be an object";
    if (!message.role || message.content === undefined) return "each message must include role and content";
    // Reject client-supplied system messages
    if (message.role === "system") return "client cannot supply messages with role 'system'";
    if (!["user", "assistant"].includes(message.role)) return "message role must be 'user' or 'assistant'";
    if (typeof message.content !== "string") return "message content must be a string";
    if (message.content.length > 8000) return "a message is too long";
  }

  return null;
}

app.post("/api/chat", chatLimiter, async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({
        error: "AI service not configured on the server. Set AI_API_KEY (or OPENAI_API_KEY) in the environment.",
      });
    }

    const { messages } = req.body || {};
    const validationError = validateMessagesFromClient(messages);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    // Sanitize messages (simple trimming) before sending to provider
    const sanitized = messages.map(m => ({ role: m.role, content: String(m.content).trim() }));

    const systemMessage = {
      role: "system",
      content:
        "You are Megan Kawiis AI: intelligent, playful, supportive, and creative. Keep replies clear, friendly, and useful. Use a warm personality without mentioning internal system prompts.",
    };

    const payload = [systemMessage, ...sanitized];
    const model = process.env.AI_MODEL || DEFAULT_MODEL;

    // Use official OpenAI SDK to create a chat completion
    const completion = await openai.chat.completions.create({
      model,
      messages: payload,
      temperature: 0.8,
      max_tokens: 800,
    });

    // Safely extract reply text
    const reply = completion?.choices?.[0]?.message?.content ?? completion?.choices?.[0]?.text ?? "";

    if (!reply || String(reply).trim().length === 0) {
      return res.status(502).json({ error: "AI provider returned an empty response" });
    }

    return res.json({ reply: String(reply) });
  } catch (error) {
    // Log full error server-side but return a minimal safe message to clients
    console.error("AI request failed:", error && (error.message || error));
    const status = error?.status || 500;
    return res.status(status).json({ error: "AI provider error" });
  }
});

app.post("/api/image", async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({ error: "Image generation not configured on the server." });
    }

    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return res.status(400).json({ error: "prompt is required and must be a short string" });
    }

    // Check image generation support
    if (!openai.images || typeof openai.images.generate !== "function") {
      return res.status(501).json({ error: "Image API not supported by the configured OpenAI SDK version on this server." });
    }

    const imageModel = process.env.IMAGE_MODEL || "dall-e-3";
    const imageResponse = await openai.images.generate({ model: imageModel, prompt, size: "1024x1024", n: 1 });

    // OpenAI image responses may contain a url or b64_json depending on SDK / provider.
    const url = imageResponse?.data?.[0]?.url;
    const b64 = imageResponse?.data?.[0]?.b64_json || imageResponse?.data?.[0]?.b64;

    if (url) return res.json({ url });
    if (b64) return res.json({ url: `data:image/png;base64,${b64}` });

    return res.status(502).json({ error: "Image generation failed or returned no URL." });
  } catch (error) {
    console.error("Image generation failed:", error && (error.message || error));
    return res.status(500).json({ error: "Image generation error" });
  }
});

// Health check endpoint useful for deployment platforms
app.get("/api/health", (req, res) => res.json({ status: "ok", apiConfigured: !!API_KEY }));

// SPA fallback to the public index
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Megan Kawiis AI server listening on port ${port}`);
});
