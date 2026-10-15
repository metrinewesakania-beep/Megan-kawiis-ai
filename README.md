# Megan Kawiis AI

A responsive full-stack AI website with a dark purple/pink design, chat session memory, browser voice features, and an Express backend that connects to a real AI provider.

## Local development

1. Install dependencies:
   npm install
2. Copy the example env file:
   cp .env.example .env
3. Add your real AI API key in `.env`:
   AI_API_KEY=your_key_here
4. Start the app:
   npm run dev
5. Open http://localhost:3000

## Required environment variables

Set these in your backend hosting environment or local `.env`:

- `AI_API_KEY` — required for chat and image generation (preferred)
- `OPENAI_API_KEY` — supported as an alternative to `AI_API_KEY`
- `AI_MODEL` — optional, example: `gpt-4o-mini`
- `IMAGE_MODEL` — optional, example: `dall-e-3`
- `PORT` — optional, default 3000
- `CHAT_RATE_LIMIT` — optional, requests per minute per IP for /api/chat (default 30)

## Deployment on Render

This project is designed to run as a Render Web Service (Render can run Node.js backends and serve static assets). GitHub Pages cannot run the Node backend.

Steps to deploy on Render:

1. Create a new Web Service on Render and connect your GitHub repo.
2. Select the branch (usually `main`).
3. Use these settings in the Render service configuration:
   - Environment: Node
   - Build command: `npm install`
   - Start command: `npm start`
4. Add the following environment variables in the Render dashboard (do NOT commit these to Git):
   - `AI_API_KEY` (or `OPENAI_API_KEY`) — your OpenAI API key
   - `AI_MODEL` — optional (example: `gpt-4o-mini`)
   - `IMAGE_MODEL` — optional (example: `dall-e-3`)
   - `CHAT_RATE_LIMIT` — optional (example: `30`)
5. Configure a health check path in Render: `/api/health` (the server returns {"status":"ok","apiConfigured":true/false}).
6. Deploy the service and monitor logs.

Render settings (important):
- Service type: Web Service
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`

Notes
- Keep all API keys in Render environment variables or in a local `.env` file that is listed in `.gitignore`.
- The frontend calls `/api/chat` and `/api/image` on the same host, so no separate CORS configuration is required for typical deployments on a single Render Web Service.

## Project notes

- The image generation feature is available only if the backend image API is configured and your OpenAI key has image generation access.
- Browser speech recognition and speech synthesis work only in browsers that support them.
- Do not commit `.env` or any real API key to Git.
