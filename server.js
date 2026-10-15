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
app.use(express.json({ limit: "64kb" }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(express.static(__dirname));

const API_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.warn("AI API key not found. /api/chat will return setup guidance until configured.");
}

let openai = null;
if (API_KEY) {
  openai = new OpenAI({ apiKey: API_KEY });
}

const DEFAULT_MODEL = process.env.AI_MODEL || "gpt-4o-mini";

function validateMessages(messages) {
  if (!Array.isArray(messages)) return "messages must be an array";
  if (messages.length === 0) return "messages is empty";
  if (messages.length > 40) return "messages too long";

  for (const message of messages) {
    if (!message || typeof message !== "object") return "each message must be an object";
    if (!message.role || !message.content) return "each message must include role and content";
    if (typeof message.content !== "string") return "message content must be a string";
    if (message.content.length > 8000) return "a message is too long";
  }

  return null;
}

app.post("/api/chat", async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({
        error: "AI service not configured on the server. Set AI_API_KEY in the environment.",
      });
    }

    const { messages } = req.body;
    const validationError = validateMessages(messages);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const systemMessage = {
      role: "system",
      content:
        "You are Megan Kawiis AI: intelligent, playful, supportive, and creative. Keep replies clear, friendly, and useful. Use a warm personality without mentioning internal system prompts.",
    };

    const payload = [systemMessage, ...messages];
    const model = process.env.AI_MODEL || DEFAULT_MODEL;

    const completion = await openai.chat.completions.create({
      model,
      messages: payload,
      temperature: 0.8,
      max_tokens: 800,
    });

    const reply = completion?.choices?.[0]?.message?.content ?? "";
    return res.json({ reply });
  } catch (error) {
    console.error("AI request failed:", error && (error.message || error));
    const status = error?.status || 500;
    return res.status(status).json({
      error: error?.message || "AI provider error",
    });
  }
});

app.post("/api/image", async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({ error: "Image generation not configured on the server." });
    }

    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return res.status(400).json({ error: "prompt is required and must be a short string" });
    }

    if (!openai.images || typeof openai.images.generate !== "function") {
      return res.status(501).json({
        error: "Image API not supported by the configured OpenAI SDK version on this server.",
      });
    }

    const imageModel = process.env.IMAGE_MODEL || "dall-e-3";
    const imageResponse = await openai.images.generate({
      model: imageModel,
      prompt,
      size: "1024x1024",
      n: 1,
    });

    const imageUrl = imageResponse?.data?.[0]?.url ?? null;
    if (!imageUrl) {
      return res.status(502).json({ error: "Image generation failed or returned no URL." });
    }

    return res.json({ url: imageUrl });
  } catch (error) {
    console.error("Image generation failed:", error && (error.message || error));
    return res.status(500).json({ error: "Image generation error" });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Megan Kawiis AI server listening on port ${port}`);
});
