import { PDFParse } from "pdf-parse";

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

export class PDFProcessor {
  async process({ id, filename, content, processingTimeMs } = {}) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(String(content ?? ""));
    try {
      const parser = new PDFParse({ data: buffer });
      const parsed = await parser.getText();
      await parser.destroy();

      const plainText = cleanText(parsed.text);
      const title = firstNonEmptyLine(plainText);
      const sections = sectionsFromPlainText(plainText);

      return Object.freeze({
        id: id ?? `processed_pdf_${filename ?? ""}`,
        sourceType: "PDF",
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
        confidence: 0.65,
        processingTimeMs,
      });
    } catch {
      return Object.freeze({
        id: id ?? `processed_pdf_${filename ?? ""}`,
        sourceType: "PDF",
        title: "",
        plainText: "",
        sections: [],
        headings: [],
        tables: [],
        metadata: {
          filename: filename ?? "",
          charCount: 0,
        },
        warnings: ["PDF parsing failed"],
        processingStatus: "FAILED",
        confidence: 0,
        processingTimeMs,
      });
    }
  }
}

