const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-CA,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Upgrade-Insecure-Requests': '1',
};

const MAX_BYTES = 2_000_000;

export class FetchError extends Error {
  constructor(message, { kind = 'fetch_failed', status } = {}) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

/**
 * Fetch page content for URL mode.
 * Tries a reader proxy first (handles JS-rendered pages + many bot walls),
 * then falls back to a direct HTML scrape.
 */
export async function fetchUrl(url) {
  let readerText = null;
  let directText = null;
  let lastError = null;

  try {
    readerText = await fetchViaReader(url);
  } catch (err) {
    lastError = err;
  }

  try {
    directText = await fetchDirect(url);
  } catch (err) {
    lastError = err;
  }

  const best = pickRicher(readerText, directText);
  if (best) return best;

  if (lastError instanceof FetchError) throw lastError;
  throw new FetchError(
    'The site blocked automatic access (bot protection).',
    { kind: 'bot_protected' }
  );
}

async function fetchViaReader(url) {
  const endpoint = `https://r.jina.ai/${url}`;
  let res;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    // Minimal headers — a full browser UA can trigger Cloudflare on the reader
    res = await fetch(endpoint, {
      headers: { Accept: 'text/plain' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (err) {
    throw new FetchError(`Reader could not reach the page: ${err.message}`, {
      kind: 'network',
    });
  }

  if (!res.ok) {
    throw new FetchError(`Reader returned status ${res.status}`, {
      kind: res.status === 403 || res.status === 429 ? 'bot_protected' : 'http_error',
      status: res.status,
    });
  }

  const text = (await res.text()).trim();
  if (!text || text.length < 40) {
    throw new FetchError('Reader returned empty content.', { kind: 'fetch_failed' });
  }
  if (/just a moment|cf-browser-verification|attention required/i.test(text)) {
    throw new FetchError('Reader hit a bot wall.', { kind: 'bot_protected' });
  }

  // Strip noisy image markdown lines; keep the story
  const cleaned = text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 12000);

  return [`SOURCE: ${url}`, '', cleaned].join('\n');
}

async function fetchDirect(url) {
  let res;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
  } catch (err) {
    throw new FetchError(`Could not reach the page: ${err.message}`, {
      kind: 'network',
    });
  }

  if (!res.ok) {
    if (res.status === 403 || res.status === 429) {
      throw new FetchError(
        'The site blocked automatic access (bot protection).',
        { kind: 'bot_protected', status: res.status }
      );
    }
    throw new FetchError(`Page returned status ${res.status}`, {
      kind: 'http_error',
      status: res.status,
    });
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
    throw new FetchError(`Unsupported content type: ${contentType}`, {
      kind: 'unsupported_type',
    });
  }

  const text = await readBounded(res, MAX_BYTES);
  if (/just a moment|cf-browser-verification|attention required/i.test(text)) {
    throw new FetchError(
      'The site blocked automatic access (bot protection).',
      { kind: 'bot_protected', status: res.status }
    );
  }
  return extractText(text, url);
}

function pickRicher(reader, direct) {
  if (!reader && !direct) return null;
  // Prefer the reader when it captured real prose — cleaner than SPA nav shells
  if (reader && score(reader) >= 60) return reader;
  if (direct && score(direct) >= 40) return direct;
  return reader || direct;
}

function score(text) {
  const body = text.replace(/^TITLE:.*$/m, '').replace(/^SOURCE:.*$/m, '').trim();
  const words = body.match(/[A-Za-z\u0600-\u06FF]{3,}/g) || [];
  const sentences = body.split(/[.!?؟]\s+/).filter((s) => s.length > 40);
  return words.length + sentences.length * 20;
}

async function readBounded(res, maxBytes) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let result = '';
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) break;
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}

function extractText(html, url) {
  let body = html;

  body = body.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  body = body.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  body = body.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  body = body.replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  body = body.replace(/<!--[\s\S]*?-->/g, ' ');

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : '';

  const mainMatch =
    body.match(/<main[\s\S]*?<\/main>/i) ||
    body.match(/<article[\s\S]*?<\/article>/i);
  if (mainMatch) body = mainMatch[0];

  body = body.replace(/<\/(p|div|section|li|h[1-6]|br|tr)>/gi, '\n');
  body = body.replace(/<br\s*\/?>/gi, '\n');
  body = body.replace(/<li[^>]*>/gi, '• ');
  body = body.replace(/<[^>]+>/g, ' ');
  body = decodeEntities(body);

  body = body
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  body = body.replace(/^(Share|Tweet|Email|Print|Copy link)\s*$/gim, '');

  const out = [];
  if (title) out.push(`TITLE: ${title}`);
  if (url) out.push(`SOURCE: ${url}`);
  out.push('');
  out.push(body.slice(0, 12000));
  return out.join('\n');
}

const ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&laquo;': '«',
  '&raquo;': '»',
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
};

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}
