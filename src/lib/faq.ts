export type Faq = { question: string; answer: string };

/** Strip the common inline-markdown so schema answers are clean plain text. */
function mdToText(s: string): string {
  return s
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract a Q&A list from an article's markdown "## Frequently asked questions"
 * (or "## FAQ") section: questions are the ### subheadings, and each answer is
 * the prose until the next ### or the next top-level ## section.
 *
 * Returns [] when there is no such section — so callers only emit FAQPage
 * structured data for articles that genuinely have an FAQ. Defensive by design:
 * malformed input yields [], never throws.
 */
export function parseFaqs(markdown: string): Faq[] {
  try {
    if (!markdown) return [];
    const lines = markdown.split(/\r?\n/);
    const faqHead =
      /^#{2,3}\s+(frequently asked questions|faqs?|common questions)\s*$/i;

    let i = 0;
    for (; i < lines.length; i++) if (faqHead.test(lines[i].trim())) break;
    if (i >= lines.length) return [];
    i++; // past the FAQ heading

    const faqs: Faq[] = [];
    let q: string | null = null;
    let ans: string[] = [];
    const flush = () => {
      if (q) {
        const answer = mdToText(ans.join(" "));
        if (answer) faqs.push({ question: mdToText(q), answer });
      }
      q = null;
      ans = [];
    };

    for (; i < lines.length; i++) {
      const t = lines[i].trim();
      // A new top-level (##, not ###) heading ends the FAQ section.
      if (/^##\s+/.test(t) && !/^###\s+/.test(t)) break;
      const qm = t.match(/^###\s+(.+?)\s*$/);
      if (qm) {
        flush();
        q = qm[1].trim();
        continue;
      }
      if (q) ans.push(lines[i]);
    }
    flush();

    // Google wants a genuine list; keep answers a sensible length for schema.
    return faqs
      .filter((f) => f.question && f.answer.length > 1)
      .map((f) => ({ question: f.question, answer: f.answer.slice(0, 1200) }))
      .slice(0, 12);
  } catch {
    return [];
  }
}
