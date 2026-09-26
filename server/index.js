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

const GHAYMAH_API_KEY = envString('GHAYMAH_API_KEY');
const GHAYMAH_BASE_URL = envString('GHAYMAH_BASE_URL', 'https://genai.ghaymah.systems/v1');
const GHAYMAH_MODEL = envString('GHAYMAH_MODEL', 'GLM-5.3-Flash');
const FOOTER_TEXT = envString('FOOTER_TEXT');
const PORT = envString('PORT', '3001');

if (!GHAYMAH_API_KEY) {
  console.warn('[warn] GHAYMAH_API_KEY is not set. Add it to .env before testing.');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    model: GHAYMAH_MODEL,
    baseUrl: GHAYMAH_BASE_URL,
    hasKey: Boolean(GHAYMAH_API_KEY),
    keyLength: GHAYMAH_API_KEY ? GHAYMAH_API_KEY.length : 0,
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
    console.error('[ghaymah] generation failed:', err);
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

  const text = await requestChatCompletion(messages);
  return polishMessage(text, { content, sourceUrl });
}

async function requestChatCompletion(messages) {
  const endpoint = `${GHAYMAH_BASE_URL.replace(/\/$/, '')}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  let resp;
  try {
    resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GHAYMAH_API_KEY}`,
      },
      body: JSON.stringify({
        model: GHAYMAH_MODEL,
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
    throw new Error(`AI ${resp.status}: ${detail.slice(0, 300)}`);
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
  console.log(`[server] model=${GHAYMAH_MODEL} base=${GHAYMAH_BASE_URL}`);
});
