import { KNOWLEDGE_SOURCE_TYPES } from "./BusinessKnowledgeDocument.js";
import { DocumentProcessingEngine } from "../../knowledge/processing/DocumentProcessingEngine.js";

const engine = new DocumentProcessingEngine();

function boundedText(bufferOrText, maxChars) {
  const text = Buffer.isBuffer(bufferOrText)
    ? bufferOrText.toString("utf8")
    : String(bufferOrText ?? "");
  return text.replace(/\s+/g, " ").trim().slice(0, Number(maxChars));
}

/**
 * Extract bounded plain text from a knowledge object for operational AI (campaigns, specialty, follow-ups).
 */
export async function extractOperationalKnowledgeText({
  buffer,
  sourceType,
  filename = "",
  maxBytes = 32 * 1024,
  maxContentChars = 4000,
} = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return "";

  const type = String(sourceType ?? "").toUpperCase();
  const boundedBuffer = buffer.length > Number(maxBytes) ? buffer.subarray(0, Number(maxBytes)) : buffer;

  if (type === KNOWLEDGE_SOURCE_TYPES.TXT || type === KNOWLEDGE_SOURCE_TYPES.MARKDOWN) {
    return boundedText(boundedBuffer, maxContentChars);
  }

  if (type === KNOWLEDGE_SOURCE_TYPES.PDF || type === KNOWLEDGE_SOURCE_TYPES.DOCX) {
    try {
      const processed = await engine.processDocument({
        id: `ops_${filename || type}`,
        sourceType: type,
        filename,
        content: boundedBuffer,
      });
      if (processed.processingStatus === "OK" && processed.plainText) {
        return boundedText(processed.plainText, maxContentChars);
      }
    } catch {
      return "";
    }
    return "";
  }

  return "";
}

export function supportsOperationalTextExtraction(sourceType) {
  const type = String(sourceType ?? "").toUpperCase();
  return type === KNOWLEDGE_SOURCE_TYPES.TXT
    || type === KNOWLEDGE_SOURCE_TYPES.MARKDOWN
    || type === KNOWLEDGE_SOURCE_TYPES.PDF
    || type === KNOWLEDGE_SOURCE_TYPES.DOCX;
}
