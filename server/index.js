import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMessages, polishMessage } from './prompt.js';
import { fetchUrl, FetchError } from './fetcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function envString(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return String(raw).trim().replace(/^['"]|['"]$/g, '');
}

const GEMINI_API_KEY = envString('GEMINI_API_KEY');
const GEMINI_BASE_URL = envString(
  'GEMINI_BASE_URL',
  'https://generativelanguage.googleapis.com/v1beta/openai',
);
const GEMINI_MODEL = envString('GEMINI_MODEL', 'gemini-3.7-flash');
const GEMINI_MODEL_FALLBACKS = envString(
  'GEMINI_MODEL_FALLBACKS',
  'gemini-flash-latest,gemini-3.6-flash,gemini-3.1-flash-lite',
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const FOOTER_TEXT = envString('FOOTER_TEXT');
const PORT = envString('PORT', '3001');

function geminiModelsToTry() {
  const seen = new Set();
  const models = [];
  for (const name of [GEMINI_MODEL, ...GEMINI_MODEL_FALLBACKS]) {
    if (name && !seen.has(name)) {
      seen.add(name);
      models.push(name);
    }
  }
  return models;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (!GEMINI_API_KEY) {
  console.warn('[warn] GEMINI_API_KEY is not set. Add it to .env before testing.');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    model: GEMINI_MODEL,
    baseUrl: GEMINI_BASE_URL,
    hasKey: Boolean(GEMINI_API_KEY),
    keyLength: GEMINI_API_KEY ? GEMINI_API_KEY.length : 0,
  });
});

app.post('/api/convert', async (req, res) => {
  const { mode, input, footer } = req.body || {};

  if (!input || typeof input !== 'string' || !input.trim()) {
    return res.status(400).json({ error: 'No input provided.' });
  }

  let content;
  let sourceUrl = null;

  if (mode === 'url') {
    const urls = input
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s));

    if (urls.length === 0) {
      return res.status(400).json({ error: 'No valid URL found.' });
    }
    if (urls.length > 1) {
      return res.status(400).json({
        error: 'Multiple URLs received. Please send one URL per request.',
      });
    }

    sourceUrl = urls[0];
    try {
      content = await fetchUrl(sourceUrl);
    } catch (err) {
      if (err instanceof FetchError) {
        const showPasteHint =
          err.kind === 'bot_protected' ||
          err.kind === 'unsupported_type' ||
          err.kind === 'network';
        return res.status(502).json({
          error: err.message,
          kind: err.kind,
          hint: showPasteHint
            ? 'Still blocked — open the page, copy the text, and use the Paste tab.'
            : null,
        });
      }
      return res.status(500).json({ error: 'Failed to fetch the URL.' });
    }
  } else {
    content = input.trim();
  }

  // Skip AI when there's not enough substance to build an alert
  const substance = content.replace(/\s+/g, ' ').trim();
  if (substance.length < 50) {
    return res.status(400).json({
      error: 'Too short — paste the full campaign, petition, or article.',
      kind: 'too_short',
    });
  }

  try {
    const message = await generateMessage({ content, sourceUrl, footer });
    res.json({ message });
  } catch (err) {
    console.error('[gemini] generation failed:', err);
    res.status(502).json({
      error: 'The AI service failed to generate a message. Try again in a moment.',
      detail: err.message,
    });
  }
});

async function generateMessage({ content, sourceUrl, footer }) {
  const messages = buildMessages({
    content,
    sourceUrl,
    footer: footer || FOOTER_TEXT,
  });

  const models = geminiModelsToTry();
  let lastError = new Error('AI request failed.');

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const text = await requestGeminiCompletion(messages, model);
        return polishMessage(text, { content, sourceUrl });
      } catch (err) {
        lastError = err;
        const busy = err.status === 503 || err.status === 429;
        if (busy && attempt < 2) {
          await sleep(750 * (attempt + 1));
          continue;
        }
        if (busy) break;
        throw err;
      }
    }
  }

  throw lastError;
}

async function requestGeminiCompletion(messages, model) {
  const endpoint = `${GEMINI_BASE_URL.replace(/\/$/, '')}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  let resp;
  try {
    resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GEMINI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    throw new Error(`AI request failed: ${err.message}`);
  }
  clearTimeout(timeout);

  if (!resp.ok) {
    const detail = await safeText(resp);
    const err = new Error(`AI ${resp.status}: ${detail.slice(0, 300)}`);
    err.status = resp.status;
    throw err;
  }

  const data = await resp.json();
  const choice = data?.choices?.[0];
  const out = choice?.message?.content;
  if (!out || !String(out).trim()) {
    const finish = choice?.finish_reason || 'unknown';
    throw new Error(`AI returned no content (finish_reason=${finish}).`);
  }

  return String(out).trim();
}

async function safeText(resp) {
  try {
    return await resp.text();
  } catch {
    return '';
  }
}

if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(__dirname, '../client/dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] model=${GEMINI_MODEL} base=${GEMINI_BASE_URL}`);
});
