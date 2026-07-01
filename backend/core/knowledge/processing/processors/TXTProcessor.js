function cleanText(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+\n/g, "\n\n")
    .trim();
}

function firstNonEmptyLine(text) {
  const lines = cleanText(text).split("\n").map((l) => l.trim()).filter(Boolean);
  return lines[0] ?? "";
}

function sectionsFromPlainText(text) {
  const cleaned = cleanText(text);
  const paras = cleaned.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);
  const title = firstNonEmptyLine(cleaned);
  if (title && paras[0] === title) return paras.slice(1);
  return paras;
}

export class TXTProcessor {
  process({ id, filename, content, processingTimeMs } = {}) {
    const plainText = cleanText(content);
    const title = firstNonEmptyLine(plainText);
    const sections = sectionsFromPlainText(plainText);

    return Object.freeze({
      id: id ?? `processed_txt_${filename ?? ""}`,
      sourceType: "TXT",
      title,
      plainText,
      sections,
      headings: [],
      tables: [],
      metadata: {
        filename: filename ?? "",
        charCount: plainText.length,
      },
      warnings: [],
      processingStatus: "OK",
      confidence: 0.6,
      processingTimeMs,
    });
  }
}

