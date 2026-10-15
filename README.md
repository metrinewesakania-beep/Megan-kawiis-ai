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

- `AI_API_KEY` — required for chat and image generation
- `AI_MODEL` — optional, example: `gpt-4o-mini`
- `IMAGE_MODEL` — optional, example: `dall-e-3`
- `PORT` — optional, default 3000

## Deployment on Render

1. Create a new Web Service on Render.
2. Connect the GitHub repo.
3. Use these settings:
   - Build command: `npm install`
   - Start command: `npm run start`
4. Add environment variables in Render:
   - `AI_API_KEY`
   - `AI_MODEL=gpt-4o-mini`
   - `IMAGE_MODEL=dall-e-3`
5. Deploy the service.

The Render URL will serve both the frontend and `/api/chat` from the same service.

## Project notes

- GitHub Pages alone cannot run the Node.js backend. Use Render or another compatible Node host for the full deployment.
- Keep all secrets in the backend environment, not in frontend files or Git commits.
- The image generation feature is available only if the backend image API is configured.
- Browser speech recognition and speech synthesis work only where the browser supports them.
