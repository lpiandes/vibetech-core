import * as mammoth from "mammoth";

function cleanText(text) {
  return String(text ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n\s+\n/g, "\n\n")
    .trim();
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

export class DOCXProcessor {
  async process({ id, filename, content, processingTimeMs } = {}) {
    // Mammoth extracts deterministic raw text from the document.
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(String(content ?? ""));

    try {
      const result = await mammoth.extractRawText({ buffer });
      const plainText = cleanText(result.value);
      const title = firstNonEmptyLine(plainText);
      const sections = sectionsFromPlainText(plainText);

      return Object.freeze({
        id: id ?? `processed_docx_${filename ?? ""}`,
        sourceType: "DOCX",
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
        confidence: 0.7,
        processingTimeMs,
      });
    } catch {
      return Object.freeze({
        id: id ?? `processed_docx_${filename ?? ""}`,
        sourceType: "DOCX",
        title: "",
        plainText: "",
        sections: [],
        headings: [],
        tables: [],
        metadata: {
          filename: filename ?? "",
          charCount: 0,
        },
        warnings: ["DOCX parsing failed"],
        processingStatus: "FAILED",
        confidence: 0,
        processingTimeMs,
      });
    }
  }
}

