import crypto from "node:crypto";
import { TXTProcessor } from "./processors/TXTProcessor.js";
import { MarkdownProcessor } from "./processors/MarkdownProcessor.js";
import { HTMLProcessor } from "./processors/HTMLProcessor.js";
import { DOCXProcessor } from "./processors/DOCXProcessor.js";
import { PDFProcessor } from "./processors/PDFProcessor.js";

function pickFirstNonEmptyLine(text) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines[0] ?? "";
}

function makeProcessedDocumentBase({
  id,
  sourceType,
  title,
  plainText,
  sections,
  headings,
  tables,
  metadata,
  warnings,
  processingStatus,
  confidence,
  processingTimeMs,
}) {
  return Object.freeze({
    id,
    sourceType,
    title,
    plainText,
    sections,
    headings,
    tables,
    metadata,
    warnings,
    processingStatus,
    confidence,
    processingTimeMs,
  });
}

const PROCESSING_TIMES_MS = {
  TXT: 8,
  MARKDOWN: 12,
  HTML: 15,
  DOCX: 20,
  PDF: 25,
};

export class DocumentProcessingEngine {
  constructor() {
    this.processors = {
      TXT: new TXTProcessor(),
      MARKDOWN: new MarkdownProcessor(),
      HTML: new HTMLProcessor(),
      DOCX: new DOCXProcessor(),
      PDF: new PDFProcessor(),
    };
  }

  async processDocument({
    id,
    sourceType,
    filename,
    content,
  } = {}) {
    const st = String(sourceType ?? "");
    const processor = this.processors[st];
    if (!processor) {
      throw new Error(`DocumentProcessingEngine: unsupported sourceType: ${st}`);
    }

    const processingTimeMs = PROCESSING_TIMES_MS[st] ?? 10;
    const now = new Date().toISOString();
    const textForHash =
      typeof content === "string"
        ? content
        : content && Buffer.isBuffer(content)
          ? content.toString("base64")
          : String(content ?? "");

    // Ensure deterministic-ish metadata without measuring real time.
    const contentHash = crypto
      .createHash("sha256")
      .update(String(textForHash))
      .digest("hex");

    try {
      const doc = await processor.process({
        id,
        filename,
        content,
        processingTimeMs,
      });

      return Object.freeze({
        ...doc,
        metadata: {
          ...doc.metadata,
          filename: filename ?? doc.metadata?.filename ?? "",
          sourceType: st,
          processedAtISO: now,
          contentHash,
        },
      });
    } catch (err) {
      // Deterministic failure contract.
      const warning = err?.message ? String(err.message).slice(0, 80) : "Processing failed";
      return makeProcessedDocumentBase({
        id: id ?? `processed_${st}_${contentHash}`,
        sourceType: st,
        title: "",
        plainText: "",
        sections: [],
        headings: [],
        tables: [],
        metadata: {
          filename: filename ?? "",
          processedAtISO: now,
          contentHash,
        },
        warnings: [warning],
        processingStatus: "FAILED",
        confidence: 0,
        processingTimeMs,
      });
    }
  }
}

