# Activism → WhatsApp

Convert activism pages (petitions, action alerts, news) into short, shareable WhatsApp messages.

One Node process serves **both** the React frontend and the Express API.

## Local setup

```bash
npm run install:all
cp .env.example .env   # add your ZAI_API_KEY
npm run dev            # http://localhost:5173 (UI) + :3001 (API)
```

## Architecture

```
Browser  →  Express (PORT)
              ├── /api/*     → GLM-5.2 via z.ai
              └── /*         → client/dist (built React app)
```

In development, Vite runs separately and proxies `/api` to Express.
In production, Express serves the built frontend itself — one URL, one deploy.

## Deploy to GitHub + Render

### 1. Code is on GitHub

This repo is the source of truth. Never commit `.env` (API keys stay in the host dashboard).

### 2. Deploy on Render (front + back together)

1. Go to [https://dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**
2. Connect this GitHub repo
3. Render reads [`render.yaml`](render.yaml) and creates one **Web Service**
4. Set these secret env vars in the Render dashboard (marked `sync: false` in the blueprint):
   - `ZAI_API_KEY` — your z.ai key
   - `FOOTER_TEXT` — (optional) AmpNet footer line
5. Deploy — you get a URL like `https://activism-to-whatsapp.onrender.com`

Render free tier sleeps after idle; the first request after sleep can take ~30–60s.

### Manual Render (without Blueprint)

- **Build:** `npm install && npm run build`
- **Start:** `npm start`
- **Env:** `NODE_ENV=production`, `ZAI_API_KEY`, `ZAI_BASE_URL`, `GLM_MODEL`

## Config

| Variable       | Default                                      | Description        |
| -------------- | -------------------------------------------- | ------------------ |
| `ZAI_API_KEY`  | (required)                                   | z.ai API key       |
| `ZAI_BASE_URL` | `https://api.z.ai/api/coding/paas/v4`        | GLM endpoint       |
| `GLM_MODEL`    | `glm-5.2`                                    | Model name         |
| `FOOTER_TEXT`  | AmpNet WhatsApp invite                       | Default footer     |
| `PORT`         | `3001` locally / set by host in production   | Server port        |
| `NODE_ENV`     | unset locally / `production` on host         | Serves `client/dist` when `production` |

## Project layout

```
server/          Express API + GLM call + static file serving
client/          Vite + React UI
render.yaml      One-click Render deploy (front + back)
.env.example     Env template (no secrets)
```
