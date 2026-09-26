# Activism → WhatsApp

Convert activism pages into short, shareable WhatsApp messages.

One Node process serves **both** the React frontend and the Express API.

## Local setup

```bash
npm run install:all
cp .env.example .env   # add your GHAYMAH_API_KEY
npm run dev            # http://localhost:5173 (UI) + :3001 (API)
```

## Architecture

```
Browser  →  Express (PORT)
              ├── /api/*     → Ghaymah GenAI (OpenAI-compatible)
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
fly secrets set GHAYMAH_API_KEY="your_key_here"
fly secrets set GHAYMAH_BASE_URL="https://genai.ghaymah.systems/v1"
fly secrets set GHAYMAH_MODEL="GLM-5.3-Flash"
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
   | `GHAYMAH_API_KEY` | your Ghaymah API key |
   | `GHAYMAH_BASE_URL` | `https://genai.ghaymah.systems/v1` |
   | `GHAYMAH_MODEL` | `GLM-5.3-Flash` |
   | `NODE_ENV` | `production` |

4. Remove old `GEMINI_*` variables if they are still set.
5. **Save** → **Manual Deploy**
6. Check `https://YOUR-SERVICE.onrender.com/api/health` — `hasKey` must be `true`

### Alternative: Railway (GitHub UI, no CLI)

1. [https://railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Select `activism-to-whatsapp`
3. Railway detects the Dockerfile automatically
4. Add variables: `GHAYMAH_API_KEY`, `GHAYMAH_BASE_URL`, `GHAYMAH_MODEL`, `NODE_ENV=production`
5. Generate a public domain under **Settings → Networking**

## Config

| Variable       | Required | Description                          |
| -------------- | -------- | ------------------------------------ |
| `GHAYMAH_API_KEY`  | yes      | API key from [genai.ghaymah.systems](https://genai.ghaymah.systems) |
| `GHAYMAH_BASE_URL` | no       | default `https://genai.ghaymah.systems/v1` |
| `GHAYMAH_MODEL`    | no       | default `GLM-5.3-Flash` (e.g. `Kimi-K3`) |
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
