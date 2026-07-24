import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_FOOTER =
  'Join AmpNet, a community fighting for truth & justice online: chat.whatsapp.com/JkcyqcS0DYFLutqL4nyb0V';

const LS_FOOTER = 'a2w_footer';
const MIN_CONTENT = 50;
const TOO_SHORT =
  'Too short — paste the full campaign, petition, or article.';

export default function App() {
  const [mode, setMode] = useState('url');
  const [input, setInput] = useState('');
  const [footer, setFooter] = useState(() => {
    return localStorage.getItem(LS_FOOTER) || DEFAULT_FOOTER;
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [exportNote, setExportNote] = useState('');
  const errorRef = useRef(null);
  const noteTimer = useRef(0);

  useEffect(() => {
    localStorage.setItem(LS_FOOTER, footer);
  }, [footer]);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [error]);

  const charCount = useMemo(() => result?.message?.length ?? 0, [result]);
  const overLimit = charCount > 768;
  const pasteLength = input.trim().length;
  const pasteTooShort = mode === 'paste' && pasteLength > 0 && pasteLength < MIN_CONTENT;
  const canConvert =
    !loading &&
    input.trim().length > 0 &&
    !(mode === 'paste' && pasteLength < MIN_CONTENT);

  function setModeSafe(next) {
    setMode(next);
    setError(null);
  }

  function onInputChange(value) {
    setInput(value);
    if (error) setError(null);
  }

  function validateBeforeSend() {
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Paste a link or some text first.');
      return false;
    }
    if (mode === 'url') {
      if (!/^https?:\/\/\S+/i.test(trimmed.split('\n')[0].trim())) {
        setError('Enter a valid link starting with https://');
        return false;
      }
      return true;
    }
    if (trimmed.length < MIN_CONTENT) {
      setError(TOO_SHORT);
      return false;
    }
    return true;
  }

  async function handleConvert() {
    setResult(null);
    setExportNote('');
    setError(null);
    if (!validateBeforeSend()) return;

    setLoading(true);
    try {
      const resp = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, input, footer }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'Something went wrong. Try again.');
      } else {
        setResult(data);
      }
    } catch {
      setError('Could not reach the server. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setInput('');
    setResult(null);
    setError(null);
    setExportNote('');
  }

  function flashNote(text) {
    setExportNote(text);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setExportNote(''), 2000);
  }

  async function handleCopy() {
    if (!result?.message) return;
    await navigator.clipboard.writeText(result.message);
    flashNote('Copied');
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadTxt() {
    if (!result?.message) return;
    downloadBlob(
      'whatsapp-message.txt',
      new Blob([result.message], { type: 'text/plain;charset=utf-8' })
    );
    flashNote('TXT downloaded');
  }

  function handleDownloadDoc() {
    if (!result?.message) return;
    const escaped = result.message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>WhatsApp Message</title></head><body><pre style="font-family:Segoe UI,Arial,sans-serif;white-space:pre-wrap;font-size:14px;">${escaped}</pre></body></html>`;
    downloadBlob(
      'whatsapp-message.doc',
      new Blob(['\ufeff', html], { type: 'application/msword' })
    );
    flashNote('DOC downloaded');
  }

  async function handleShare() {
    if (!result?.message) return;
    if (navigator.share) {
      try {
        await navigator.share({ text: result.message });
        flashNote('Shared');
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    window.open(
      `https://wa.me/?text=${encodeURIComponent(result.message)}`,
      '_blank',
      'noopener,noreferrer'
    );
    flashNote('Opened WhatsApp');
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Activism → WhatsApp</h1>
        <p className="tagline">Turn action pages into shareable messages</p>
      </header>

      <div className="workspace">
        <div className="composer">
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'url'}
              className={`tab ${mode === 'url' ? 'active' : ''}`}
              onClick={() => setModeSafe('url')}
            >
              URL Mode
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'paste'}
              className={`tab ${mode === 'paste' ? 'active' : ''}`}
              onClick={() => setModeSafe('paste')}
            >
              Paste Content
            </button>
          </div>

          {mode === 'url' ? (
            <section className="panel">
              <label className="label" htmlFor="input-url">
                Paste an action page link
              </label>
              <textarea
                id="input-url"
                className="textarea"
                rows={3}
                placeholder="https://actionnetwork.org/letters/..."
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                disabled={loading}
              />
              <p className="hint">
                One link at a time. If a site blocks access, switch to Paste.
              </p>
            </section>
          ) : (
            <section className="panel">
              <div className="label-row">
                <label className="label" htmlFor="input-paste">
                  Paste the page content here
                </label>
                <span
                  className={`input-count ${pasteTooShort ? 'warn' : ''}`}
                  aria-live="polite"
                >
                  {pasteLength} / {MIN_CONTENT} min
                </span>
              </div>
              <textarea
                id="input-paste"
                className={`textarea ${pasteTooShort ? 'textarea-warn' : ''}`}
                rows={10}
                placeholder="Open the page in your browser, select all (Ctrl+A), copy, and paste here."
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                disabled={loading}
              />
              <p className="hint">
                {pasteTooShort
                  ? TOO_SHORT
                  : 'Use this when a site shows bot protection.'}
              </p>
            </section>
          )}

          <details className="settings">
            <summary>Footer text</summary>
            <textarea
              className="textarea footer-input"
              rows={2}
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              disabled={loading}
              aria-label="Footer text appended to every message"
            />
            <p className="hint">Appended to every message. Saved in your browser.</p>
          </details>

          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConvert}
              disabled={!canConvert}
            >
              {loading ? 'Converting…' : 'Convert'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleClear}
              disabled={loading || (!input && !result && !error)}
            >
              Clear
            </button>
          </div>

          {error && (
            <div className="alert alert-error" role="alert" ref={errorRef}>
              <p>{error}</p>
            </div>
          )}
        </div>

        <div className="preview">
          {result ? (
            <section className="result">
              <div className="result-head">
                <span>Preview</span>
                <span className={`charcount ${overLimit ? 'over' : ''}`}>
                  {charCount} / 768
                </span>
              </div>

              <div className="phone">
                <div className="phone-bar">WhatsApp</div>
                <div className="phone-body">
                  <Bubble message={result.message} />
                </div>
              </div>

              <div className="export">
                <p className="export-label">Copy + Export</p>
                <div className="export-grid">
                  <button type="button" className="btn btn-primary" onClick={handleCopy}>
                    Copy formatted text
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleDownloadTxt}
                  >
                    Download TXT
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleDownloadDoc}
                  >
                    Download DOC
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleShare}>
                    Share
                  </button>
                </div>
                <p className="export-note" aria-live="polite">
                  {exportNote || '\u00a0'}
                </p>
              </div>

              <details className="raw">
                <summary>View raw text</summary>
                <pre>{result.message}</pre>
              </details>
            </section>
          ) : (
            <EmptyState loading={loading} />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ loading }) {
  return (
    <div className="empty">
      <div className={`phone phone-muted ${loading ? 'phone-loading' : ''}`}>
        <div className="phone-bar">WhatsApp</div>
        <div className="phone-body">
          <div className="bubble bubble-ghost">
            <p>
              {loading
                ? 'Writing your message…'
                : 'Your WhatsApp message will appear here.'}
            </p>
            <span className="bubble-time">now</span>
          </div>
        </div>
      </div>
      <p className="empty-hint">
        {loading ? (
          'Usually takes a few seconds.'
        ) : (
          <>
            Paste a link or text, then hit <strong>Convert</strong>.
          </>
        )}
      </p>
    </div>
  );
}

function Bubble({ message }) {
  const lines = message.split('\n');
  return (
    <div className="bubble">
      {lines.map((line, i) => (
        <p key={i}>
          <FormattedLine text={line} />
        </p>
      ))}
      <span className="bubble-time">
        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

function FormattedLine({ text }) {
  const parts = parseInline(text);
  return parts.map((part, i) => {
    if (part.type === 'bold') return <strong key={i}>{part.value}</strong>;
    if (part.type === 'italic') return <em key={i}>{part.value}</em>;
    if (part.type === 'link') {
      return (
        <a key={i} href={part.value} target="_blank" rel="noreferrer">
          {part.value}
        </a>
      );
    }
    return <span key={i}>{part.value}</span>;
  });
}

function parseInline(text) {
  const tokens = [];
  let rest = text;
  const patterns = [
    { re: /^\*([^*\n]+)\*/, type: 'bold' },
    { re: /^_([^_\n]+)_/, type: 'italic' },
    { re: /^(https?:\/\/[^\s]+)/, type: 'link' },
  ];

  while (rest.length > 0) {
    let matched = false;
    for (const { re, type } of patterns) {
      const m = rest.match(re);
      if (m) {
        tokens.push({ type, value: m[1] });
        rest = rest.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      const next = rest.slice(1).search(/[*_h]/);
      const take = next === -1 ? rest.length : next + 1;
      tokens.push({ type: 'text', value: rest.slice(0, take) });
      rest = rest.slice(take);
    }
  }
  return tokens;
}
