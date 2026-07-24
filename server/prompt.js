const DEFAULT_FOOTER =
  process.env.FOOTER_TEXT ||
  'Join AmpNet, a community fighting for truth & justice online: chat.whatsapp.com/JkcyqcS0DYFLutqL4nyb0V';

export function buildMessages({ content, sourceUrl, footer }) {
  const footerLine = (footer && footer.trim()) || DEFAULT_FOOTER;

  const system = `You write short, shareable WhatsApp messages that turn activism pages (petitions, emails, news, action alerts) into compelling calls to action.

You follow ONE exact template. You never deviate from the structure, the spacing, or the footer.`;

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

Key patterns from these examples:
- Start with an emoji and bold title describing the action type (📧 EMAIL, ✍🏽 PETITION, etc.)
- Tell the story with specifics: dates, names, what actually happened
- Include supporting links (Instagram, news) when you find them in the content
- Frame the systemic issue in bold if there's a broader pattern of injustice
- Call to action with *👉🏽 Act Now* followed by what they should do
- Original URL after 🔻 in bold asterisks
- Always end with the exact footer shown above

Write naturally - let the details flow as a story rather than listing facts. Keep under 768 characters total.

---

Now write ONE message for the following content. Use the structure above EXACTLY.

Source URL: ${sourceUrl || '(not provided — infer the action link from the content if possible)'}

CONTENT:
"""
${content}
"""

Footer to use (replace the AmpNet footer in the examples with this one, verbatim, on the final line, prefixed with "✊🏽 _" and suffixed with "_"):
${footerLine}

Return ONLY the finished WhatsApp message. No preamble, no explanation, no quotes around it.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
