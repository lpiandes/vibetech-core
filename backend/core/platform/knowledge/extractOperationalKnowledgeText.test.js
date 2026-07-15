import assert from "node:assert/strict";
import { test } from "node:test";
import { Document, Packer, Paragraph, TextRun } from "docx";

import {
  extractOperationalKnowledgeText,
  supportsOperationalTextExtraction,
} from "./extractOperationalKnowledgeText.js";
import { KNOWLEDGE_SOURCE_TYPES } from "./BusinessKnowledgeDocument.js";

test("supportsOperationalTextExtraction includes PDF and DOCX", () => {
  assert.equal(supportsOperationalTextExtraction(KNOWLEDGE_SOURCE_TYPES.PDF), true);
  assert.equal(supportsOperationalTextExtraction(KNOWLEDGE_SOURCE_TYPES.DOCX), true);
  assert.equal(supportsOperationalTextExtraction(KNOWLEDGE_SOURCE_TYPES.TXT), true);
});

test("extractOperationalKnowledgeText parses DOCX via mammoth", async () => {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          children: [new TextRun("USA Baseball practice planning guidance for station work.")],
        }),
      ],
    }],
  });
  const buffer = await Packer.toBuffer(doc);
  const text = await extractOperationalKnowledgeText({
    buffer,
    sourceType: KNOWLEDGE_SOURCE_TYPES.DOCX,
    filename: "practice.docx",
  });
  assert.match(text, /USA Baseball practice planning/i);
});
