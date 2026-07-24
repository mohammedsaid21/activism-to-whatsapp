import { useEffect, useMemo, useState } from 'react';

const DEFAULT_FOOTER =
  'Join AmpNet, a community fighting for truth & justice online: chat.whatsapp.com/JkcyqcS0DYFLutqL4nyb0V';

const LS_FOOTER = 'a2w_footer';

export default function App() {
  const [mode, setMode] = useState('url');
  const [input, setInput] = useState('');
  const [footer, setFooter] = useState(() => {
    return localStorage.getItem(LS_FOOTER) || DEFAULT_FOOTER;
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    localStorage.setItem(LS_FOOTER, footer);
  }, [footer]);

  const charCount = useMemo(() => result?.message?.length ?? 0, [result]);
  const overLimit = charCount > 768;

  async function handleConvert() {
    setError(null);
    setResult(null);
    if (!input.trim()) {
      setError('Please paste a link or some text first.');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, input, footer }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        const parts = [data.error, data.hint, data.detail].filter(Boolean);
        setError(parts.join('\n\n'));
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(`Could not reach the server. Is it running?\n\n${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setInput('');
    setResult(null);
    setError(null);
  }

  async function handleCopy() {
    if (!result?.message) return;
    await navigator.clipboard.writeText(result.message);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Activism → WhatsApp</h1>
        <p className="tagline">Turn action pages into shareable messages</p>
      </header>

      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={mode === 'url'}
          className={`tab ${mode === 'url' ? 'active' : ''}`}
          onClick={() => setMode('url')}
        >
          URL Mode
        </button>
        <button
          role="tab"
          aria-selected={mode === 'paste'}
          className={`tab ${mode === 'paste' ? 'active' : ''}`}
          onClick={() => setMode('paste')}
        >
          Paste Content
        </button>
      </div>

      {mode === 'url' ? (
        <section className="panel">
          <label className="label">Paste an action page link</label>
          <textarea
            className="textarea"
            rows={4}
            placeholder="https://actionnetwork.org/letters/..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <p className="hint">
            One link at a time. If a site blocks access, switch to the Paste tab.
          </p>
        </section>
      ) : (
        <section className="panel">
          <label className="label">Paste the page content here</label>
          <textarea
            className="textarea"
            rows={10}
            placeholder="Open the page in your browser, select all (Ctrl+A), copy, and paste here."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <p className="hint">Use this when a site shows bot protection.</p>
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
        />
        <p className="hint">Appended to every message. Saved in your browser.</p>
      </details>

      <div className="actions">
        <button
          className="btn btn-primary"
          onClick={handleConvert}
          disabled={loading || !input.trim()}
        >
          {loading ? 'Converting…' : 'Convert'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={handleClear}
          disabled={loading}
        >
          Clear
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <pre>{error}</pre>
        </div>
      )}

      {result && (
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

          <button className="btn btn-primary copy-btn" onClick={handleCopy}>
            Copy message
          </button>

          <details className="raw">
            <summary>View raw text</summary>
            <pre>{result.message}</pre>
          </details>
        </section>
      )}
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
      <span className="bubble-time">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  );
}

function FormattedLine({ text }) {
  // Render *bold* and _italic_ (WhatsApp style)
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
      // take plain chars up to next special char
      const next = rest.slice(1).search(/[*_h]/);
      const take = next === -1 ? rest.length : next + 1;
      tokens.push({ type: 'text', value: rest.slice(0, take) });
      rest = rest.slice(take);
    }
  }
  return tokens;
}
