function normalizeNewlines(text) {
  return String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function stripHtmlBasic(html) {
  let s = String(html ?? "");
  s = s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n\n").trim();
  return s;
}

function extractTitleFromHtml(html) {
  const m = String(html ?? "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m) {
    const t = m[1].replace(/[\r\n]+/g, " ").trim();
    if (t) return t.slice(0, 120);
  }
  const h1 = extractHeadingsFromHtml(html, 1)[0] ?? "";
  return h1.slice(0, 120);
}

function extractHeadingsFromHtml(html, levelMin = 1, levelMax = 3) {
  const headings = [];
  const s = String(html ?? "");
  for (let level = levelMin; level <= levelMax; level += 1) {
    const re = new RegExp(`<h${level}[^>]*>([\\s\\S]*?)<\\/h${level}>`, "gi");
    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = re.exec(s))) {
      const raw = match[1];
      const cleaned = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (cleaned) headings.push(cleaned);
    }
  }
  return headings;
}

function sectionsFromPlainText(text) {
  return stripHtmlBasic(text)
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

function extractHtmlTables(html) {
  const tables = [];
  const s = String(html ?? "");
  const tableRe = /<table[\s\S]*?>[\s\S]*?<\/table>/gi;
  const allTables = s.match(tableRe) ?? [];

  for (const t of allTables) {
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows = [];
    let rowMatch;
    // eslint-disable-next-line no-cond-assign
    while ((rowMatch = rowRe.exec(t))) {
      const rowHtml = rowMatch[1];
      const cellRe = /<(td|th)[^>]*>([\s\S]*?)<\/(td|th)>/gi;
      const cells = [];
      let cellMatch;
      // eslint-disable-next-line no-cond-assign
      while ((cellMatch = cellRe.exec(rowHtml))) {
        const cellText = cellMatch[2]
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        cells.push(cellText);
      }
      if (cells.length) rows.push(cells);
    }

    if (rows.length) {
      tables.push({ rows });
    }
  }

  return tables;
}

export class HTMLProcessor {
  process({ id, filename, content, processingTimeMs } = {}) {
    const raw = String(content ?? "");
    const plainText = stripHtmlBasic(raw);
    const title = extractTitleFromHtml(raw);
    const headings = extractHeadingsFromHtml(raw, 1, 3);
    const sections = sectionsFromPlainText(raw);
    const tables = extractHtmlTables(raw);

    return Object.freeze({
      id: id ?? `processed_html_${filename ?? ""}`,
      sourceType: "HTML",
      title,
      plainText,
      sections,
      headings,
      tables,
      metadata: {
        filename: filename ?? "",
        charCount: plainText.length,
      },
      warnings: title ? [] : ["No HTML title or H1 detected; title is empty."],
      processingStatus: "OK",
      confidence: 0.72,
      processingTimeMs,
    });
  }
}

