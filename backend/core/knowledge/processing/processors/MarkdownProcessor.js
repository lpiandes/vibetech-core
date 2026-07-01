function normalizeNewlines(text) {
  return String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function stripCodeFences(text) {
  return String(text ?? "").replace(/```[\s\S]*?```/g, " ");
}

function stripMarkdownFormatting(text) {
  let s = String(text ?? "");
  // Convert links: [text](url) => text (url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  // Remove inline code
  s = s.replace(/`([^`]+)`/g, "$1");
  // Remove emphasis markers
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");
  // Remove list markers
  s = s.replace(/^\s*([-*+]|\d+\.)\s+/gm, "");
  // Remove blockquote markers
  s = s.replace(/^\s*>\s?/gm, "");
  return s;
}

function cleanText(text) {
  return stripMarkdownFormatting(
    String(text ?? "").replace(/\n\s+\n/g, "\n\n").replace(/[ \t]+/g, " ").trim(),
  );
}

function firstNonEmptyLine(text) {
  const lines = cleanText(text).split("\n").map((l) => l.trim()).filter(Boolean);
  return lines[0] ?? "";
}

function sectionsFromPlainText(text) {
  const cleaned = cleanText(text);
  return cleaned
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

function extractHeadingsFromMarkdown(markdown) {
  const lines = normalizeNewlines(markdown).split("\n");
  const headings = [];
  for (const line of lines) {
    const m = String(line).match(/^(#{1,6})\s+(.*)$/);
    if (m) headings.push(m[2].trim());
  }
  return headings;
}

function extractMarkdownTables(markdown) {
  const lines = normalizeNewlines(markdown).split("\n").map((l) => l.trimEnd());
  const tables = [];

  for (let i = 0; i < lines.length - 1; i += 1) {
    const line = lines[i];
    const next = lines[i + 1];
    if (!line.includes("|") || !next.includes("|")) continue;
    if (!/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(next.replace(/\s+/g, " "))) {
      continue;
    }

    const parseRow = (row) => {
      const trimmed = row.trim();
      const noEdge = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
      const noEdge2 = noEdge.endsWith("|") ? noEdge.slice(0, -1) : noEdge;
      return noEdge2.split("|").map((c) => c.trim());
    };

    const header = parseRow(line);
    const rows = [];
    let j = i + 2;
    while (j < lines.length && lines[j].includes("|") && lines[j].trim().length) {
      rows.push(parseRow(lines[j]));
      j += 1;
    }

    tables.push({ headers: header, rows });
    i = j - 1;
  }

  return tables;
}

export class MarkdownProcessor {
  process({ id, filename, content, processingTimeMs } = {}) {
    const raw = String(content ?? "");
    const withoutCode = stripCodeFences(raw);

    const headings = extractHeadingsFromMarkdown(raw);
    const tables = extractMarkdownTables(raw);

    const plainText = cleanText(withoutCode);
    const title = headings.length ? headings[0] : firstNonEmptyLine(plainText);
    const sections = sectionsFromPlainText(withoutCode);

    return Object.freeze({
      id: id ?? `processed_md_${filename ?? ""}`,
      sourceType: "MARKDOWN",
      title,
      plainText,
      sections,
      headings,
      tables,
      metadata: {
        filename: filename ?? "",
        charCount: plainText.length,
      },
      warnings: headings.length ? [] : ["No markdown headings detected; using first line as title."],
      processingStatus: "OK",
      confidence: 0.75,
      processingTimeMs,
    });
  }
}

