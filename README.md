# Activism → WhatsApp

Convert activism pages into short, shareable WhatsApp messages.

One Node process serves **both** the React frontend and the Express API.

## Local setup

```bash
npm run install:all
cp .env.example .env   # add your GEMINI_API_KEY (Google AI Studio)
npm run dev            # http://localhost:5173 (UI) + :3001 (API)
```

## Architecture

```
Browser  →  Express (PORT)
              ├── /api/*     → Gemini via Google AI API
              └── /*         → client/dist (built React app)
```

## Deploy (Fly.io — recommended)

Front and back ship together via Docker. Free allowance is separate from Render.

### One-time

1. Create a free account: [https://fly.io/app/sign-up](https://fly.io/app/sign-up)
2. Install the CLI and log in:

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

### Deploy this app

From the project root:

```bash
fly launch --no-deploy          # uses fly.toml already in the repo
fly secrets set GEMINI_API_KEY="your_key_here"
fly secrets set GEMINI_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai"
fly secrets set GEMINI_MODEL="gemini-3.8-flash"
fly secrets set FOOTER_TEXT="Join AmpNet, a community fighting for truth & justice online: chat.whatsapp.com/JkcyqcS0DYFLutqL4nyb0V"
fly deploy
```

Your live URL will be: `https://activism-to-whatsapp.fly.dev`

Later updates: just `fly deploy` again after pushing code.

### Alternative: Render

1. [https://render.com](https://render.com) → **New** → **Web Service** → connect this GitHub repo
2. **Build command:** `npm run build` · **Start command:** `npm start`
3. Under **Environment**, add (no quotes around the key value):

   | Key | Value |
   | --- | --- |
   | `GEMINI_API_KEY` | your key from [Google AI Studio](https://aistudio.google.com/apikey) |
   | `GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` |
   | `GEMINI_MODEL` | `gemini-3.7-flash` (optional; server retries / falls back if busy) |
   | `NODE_ENV` | `production` |

4. **Save** → **Manual Deploy** (or wait for auto-deploy after push)
5. Check `https://YOUR-SERVICE.onrender.com/api/health` — `hasKey` must be `true` and `keyLength` &gt; 0

### Alternative: Railway (GitHub UI, no CLI)

1. [https://railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Select `activism-to-whatsapp`
3. Railway detects the Dockerfile automatically
4. Add variables: `GEMINI_API_KEY`, `GEMINI_BASE_URL`, `GEMINI_MODEL`, `NODE_ENV=production`
5. Generate a public domain under **Settings → Networking**

## Config

| Variable       | Required | Description                          |
| -------------- | -------- | ------------------------------------ |
| `GEMINI_API_KEY`  | yes      | [Google AI Studio](https://aistudio.google.com/apikey) API key |
| `GEMINI_BASE_URL` | no       | default `https://generativelanguage.googleapis.com/v1beta/openai` |
| `GEMINI_MODEL`    | no       | default `gemini-3.7-flash`           |
| `GEMINI_MODEL_FALLBACKS` | no | comma-separated backup models if the primary is busy |
| `FOOTER_TEXT`  | no       | AmpNet footer line                   |
| `PORT`         | no       | host sets this (Fly uses `8080`)     |
| `NODE_ENV`     | no       | `production` in Docker image         |

## Project layout

```
server/          Express API + AI + static file serving
client/          Vite + React UI
Dockerfile       Production image (front build + back)
fly.toml         Fly.io config
.env.example     Env template (never commit real secrets)
```
