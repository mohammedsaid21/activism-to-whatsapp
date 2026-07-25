const DEFAULT_FOOTER =
  process.env.FOOTER_TEXT ||
  'Join AmpNet, a community fighting for truth & justice online: chat.whatsapp.com/JkcyqcS0DYFLutqL4nyb0V';

export function buildMessages({ content, sourceUrl, footer }) {
  const footerLine = (footer && footer.trim()) || DEFAULT_FOOTER;

  const system = `You write short, shareable WhatsApp messages that turn activism pages (petitions, emails, news, action alerts) into compelling calls to action.

You follow ONE exact template. You never deviate from the structure, the spacing, or the footer.
You NEVER invent or guess URLs. If a link is not present in the provided content or Source URL, you leave a placeholder.`;

  const user = `Study these examples to understand the style - notice how they tell a story with concrete details rather than abstract appeals:

📧 *EMAIL: Arabic is Not a Threatening Language, Paul!*

On Oct 7, Earl Haig students played the national anthem in Arabic, as part of their regular practice of playing it in different languages. Education Minister Paul Calandra condemned it, suggesting it made people feel unsafe. He linked it to the anniversary of "the worst terrorist attack against the Jewish people," implying that Arabic and Arabs were threatening.
https://instagram.com/p/DPrVoUrEdFp

*👉🏽 Act Now* – Defend the students & demand accountability!
🔻 *actionnetwork.org/letters/arabic-is-not-threatening*


✊🏽 _Join AmpNet, a community fighting for truth & justice online:_ chat.whatsapp.com/JkcyqcS0DYFLutqL4nyb0V

---

✍🏽 *PETITION: Equitable Immigration for Palestinians in Crisis!*

The ongoing humanitarian crisis & suspected genocide in Gaza & the West Bank demand Canada's urgent response. While Ukrainian visas were swift, Palestinian applications face unacceptable delays over a year. Act now to ensure Canada upholds its moral & legal obligations!
https://globalnews.ca/news/11301399

*👉🏽 Act Now* – Sign the petition demanding equitable & urgent action for Palestinians!
🔻 *change.org/equitable-immigration*


✊🏽 _Join AmpNet, a community fighting for truth & justice online:_ chat.whatsapp.com/JkcyqcS0DYFLutqL4nyb0V

---

Example when NO action link exists in the content (do NOT invent one):

📢 *ALERT: Title Here!*

Story with concrete details goes here.

*👉🏽 Act Now* – What they should do!
🔻 *[INSERT LINK]*


✊🏽 _Join AmpNet, a community fighting for truth & justice online:_ chat.whatsapp.com/JkcyqcS0DYFLutqL4nyb0V

Key patterns from these examples:
- Start with an emoji and bold title describing the action type (📧 EMAIL, ✍🏽 PETITION, etc.)
- Tell the story with specifics: dates, names, what actually happened
- Include supporting links (Instagram, news) ONLY when they appear in the provided content — never invent them
- Frame the systemic issue in bold if there's a broader pattern of injustice
- Call to action with *👉🏽 Act Now* followed by what they should do
- After 🔻 put the real action URL in bold asterisks — ONLY if that exact URL (or a clear action URL) appears in the content or Source URL below
- If there is NO real action link available, write exactly: 🔻 *[INSERT LINK]*  — leave this blank placeholder for the human to fill. NEVER invent ActionNetwork, Change.org, or any other URL
- Always end with the footer
- Put ONE blank line, then ANOTHER blank line, above the footer (double space before ✊🏽)

Write naturally - let the details flow as a story rather than listing facts. Keep under 768 characters total.

---

Now write ONE message for the following content. Use the structure above EXACTLY.

Source URL: ${sourceUrl || '(not provided)'}

CONTENT:
"""
${content}
"""

Footer to use (replace the AmpNet footer in the examples with this one, verbatim, on the final line, prefixed with "✊🏽 _" and suffixed with "_"):
${footerLine}

CRITICAL:
- Do not invent URLs. Missing action link → 🔻 *[INSERT LINK]*
- Double blank line before the footer line

Return ONLY the finished WhatsApp message. No preamble, no explanation, no quotes around it.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/** Strip hallucinated 🔻 links and normalize footer spacing. */
export function polishMessage(message, { content = '', sourceUrl = '' } = {}) {
  let out = String(message || '').trim();

  // Two blank lines above the AmpNet / custom footer
  out = out.replace(/\n+(?=✊🏽\s*_)/, '\n\n\n');

  const haystack = `${content}\n${sourceUrl || ''}`.toLowerCase();
  out = out.replace(/🔻\s*\*([^*]+)\*/g, (full, raw) => {
    const link = String(raw).trim();
    if (!link || /^\[?insert link\]?$/i.test(link)) {
      return '🔻 *[INSERT LINK]*';
    }
    if (linkAppearsInSource(link, haystack, sourceUrl)) {
      return `🔻 *${link}*`;
    }
    return '🔻 *[INSERT LINK]*';
  });

  return out.trim();
}

function linkAppearsInSource(link, haystack, sourceUrl) {
  const normalized = link
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '')
    .toLowerCase();

  if (!normalized) return false;
  if (haystack.includes(normalized)) return true;
  if (haystack.includes(link.toLowerCase())) return true;

  // Allow the provided Source URL (or its host/path) as the action link
  if (sourceUrl) {
    const src = sourceUrl
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/$/, '')
      .toLowerCase();
    if (normalized === src || src.includes(normalized) || normalized.includes(src)) {
      return true;
    }
  }
  return false;
}
