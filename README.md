# Activism → WhatsApp

Convert activism pages into short, shareable WhatsApp messages.

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
              ├── /api/*     → DeepSeek-V3-0324 via Ghaymah
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
fly secrets set ZAI_API_KEY="your_key_here"
fly secrets set ZAI_BASE_URL="https://genai.ghaymah.systems/v1"
fly secrets set GLM_MODEL="DeepSeek-V3-0324"
fly secrets set FOOTER_TEXT="Join AmpNet, a community fighting for truth & justice online: chat.whatsapp.com/JkcyqcS0DYFLutqL4nyb0V"
fly deploy
```

Your live URL will be: `https://activism-to-whatsapp.fly.dev`

Later updates: just `fly deploy` again after pushing code.

### Alternative: Railway (GitHub UI, no CLI)

1. [https://railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Select `activism-to-whatsapp`
3. Railway detects the Dockerfile automatically
4. Add variables: `ZAI_API_KEY`, `ZAI_BASE_URL`, `GLM_MODEL`, `NODE_ENV=production`
5. Generate a public domain under **Settings → Networking**

## Config

| Variable       | Required | Description                          |
| -------------- | -------- | ------------------------------------ |
| `ZAI_API_KEY`  | yes      | Ghaymah API key                      |
| `ZAI_BASE_URL` | no       | default `https://genai.ghaymah.systems/v1` |
| `GLM_MODEL`    | no       | default `DeepSeek-V3-0324`           |
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
