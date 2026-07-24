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

export async function fetchUrl(url) {
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
  return extractText(text, url);
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

  // Strip non-content blocks before extracting text
  body = body.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  body = body.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  body = body.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  body = body.replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  body = body.replace(/<!--[\s\S]*?-->/g, ' ');

  // Pull <title> for context
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : '';

  // Prefer <main>, <article>, or role=main if present
  const mainMatch =
    body.match(/<main[\s\S]*?<\/main>/i) ||
    body.match(/<article[\s\S]*?<\/article>/i);
  if (mainMatch) body = mainMatch[0];

  // Convert block elements to newlines so paragraphs survive
  body = body.replace(/<\/(p|div|section|li|h[1-6]|br|tr)>/gi, '\n');
  body = body.replace(/<br\s*\/?>/gi, '\n');
  body = body.replace(/<li[^>]*>/gi, '• ');

  // Strip all remaining tags
  body = body.replace(/<[^>]+>/g, ' ');

  body = decodeEntities(body);

  // Collapse whitespace
  body = body
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Drop common boilerplate lines
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
