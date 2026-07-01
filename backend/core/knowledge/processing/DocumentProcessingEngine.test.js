import assert from "node:assert/strict";
import { test } from "node:test";

import { DocumentProcessingEngine } from "./DocumentProcessingEngine.js";

import { Document, Packer, Paragraph, TextRun } from "docx";
import PDFDocument from "pdfkit";

async function makeDocxBuffer({ title, body } = {}) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({ children: [new TextRun(title ?? "Docx Title")] }),
          new Paragraph({ text: body ?? "Docx body paragraph." }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

async function makePdfBuffer({ title, body } = {}) {
  const pdf = new PDFDocument();
  const chunks = [];

  pdf.on("data", (c) => chunks.push(c));

  pdf.text(title ?? "Pdf Title");
  pdf.text(body ?? "Pdf body paragraph.");
  pdf.end();

  await new Promise((resolve, reject) => {
    pdf.on("end", resolve);
    pdf.on("error", reject);
  });

  return Buffer.concat(chunks);
}

test("TXT processor: deterministic title/sections", async () => {
  const engine = new DocumentProcessingEngine();

  const doc = await engine.processDocument({
    id: "doc_txt_1",
    sourceType: "TXT",
    filename: "note.txt",
    content: "My Title\n\nFirst paragraph.\n\nSecond paragraph.",
  });

  assert.equal(doc.processingStatus, "OK");
  assert.equal(doc.title, "My Title");
  assert.ok(doc.plainText.includes("First paragraph."));
  assert.equal(doc.sections.length, 2);
  assert.deepEqual(doc.headings, []);
  assert.deepEqual(doc.tables, []);
});

test("Markdown processor: headings and tables extraction", async () => {
  const engine = new DocumentProcessingEngine();

  const md = [
    "# My Doc",
    "",
    "Intro paragraph with a [link](https://example.com).",
    "",
    "## Section A",
    "",
    "- Item 1",
    "- Item 2",
    "",
    "| Name | Value |",
    "| ---- | ----- |",
    "| A | 1 |",
  ].join("\n");

  const doc = await engine.processDocument({
    id: "doc_md_1",
    sourceType: "MARKDOWN",
    filename: "doc.md",
    content: md,
  });

  assert.equal(doc.processingStatus, "OK");
  assert.ok(doc.title.includes("My Doc"));
  assert.ok(doc.headings.includes("My Doc"));
  assert.ok(doc.headings.includes("Section A"));
  assert.equal(doc.tables.length, 1);
  assert.deepEqual(doc.tables[0].headers, ["Name", "Value"]);
  assert.deepEqual(doc.tables[0].rows[0], ["A", "1"]);
});

test("HTML processor: strip markup + extract title/headings/tables", async () => {
  const engine = new DocumentProcessingEngine();
  const html = [
    "<html>",
    "<head><title>HTML Title</title></head>",
    "<body>",
    "<h1>Main Heading</h1>",
    "<h2>Sub Heading</h2>",
    "<p>Hello <b>world</b>.</p>",
    "<table><tr><th>H</th><th>W</th></tr><tr><td>1</td><td>2</td></tr></table>",
    "</body>",
    "</html>",
  ].join("");

  const doc = await engine.processDocument({
    id: "doc_html_1",
    sourceType: "HTML",
    filename: "page.html",
    content: html,
  });

  assert.equal(doc.processingStatus, "OK");
  assert.equal(doc.title, "HTML Title");
  assert.ok(doc.headings.includes("Main Heading"));
  assert.ok(doc.headings.includes("Sub Heading"));
  assert.ok(doc.plainText.toLowerCase().includes("hello world"));
  assert.equal(doc.tables.length, 1);
  assert.deepEqual(doc.tables[0].rows[0][0], "H");
  assert.deepEqual(doc.tables[0].rows[1][0], "1");
});

test("DOCX processor: real parsing via mammoth", async () => {
  const engine = new DocumentProcessingEngine();
  const buffer = await makeDocxBuffer({ title: "Docx Title", body: "Docx body paragraph." });

  const doc = await engine.processDocument({
    id: "doc_docx_1",
    sourceType: "DOCX",
    filename: "file.docx",
    content: buffer,
  });

  assert.equal(doc.processingStatus, "OK");
  assert.equal(doc.title, "Docx Title");
  assert.ok(doc.plainText.includes("Docx body paragraph."));
});

test("PDF processor: real parsing via pdf-parse", async () => {
  const engine = new DocumentProcessingEngine();
  const buffer = await makePdfBuffer({
    title: "Pdf Title",
    body: "Pdf body paragraph.",
  });

  const doc = await engine.processDocument({
    id: "doc_pdf_1",
    sourceType: "PDF",
    filename: "file.pdf",
    content: buffer,
  });

  assert.equal(doc.processingStatus, "OK");
  assert.equal(doc.title, "Pdf Title");
  assert.ok(doc.plainText.includes("Pdf body paragraph."));
});

test("Unsupported formats: engine throws", async () => {
  const engine = new DocumentProcessingEngine();
  await assert.rejects(() =>
    engine.processDocument({
      id: "doc_unknown_1",
      sourceType: "MP3",
      filename: "audio.mp3",
      content: "x",
    }),
  );
});

test("Malformed DOCX/PDF: deterministic failure warnings", async () => {
  const engine = new DocumentProcessingEngine();

  const badDocx = await engine.processDocument({
    id: "doc_bad_docx_1",
    sourceType: "DOCX",
    filename: "bad.docx",
    content: Buffer.from("not a real docx"),
  });
  assert.equal(badDocx.processingStatus, "FAILED");
  assert.ok(badDocx.warnings.some((w) => /DOCX parsing failed/i.test(w)));

  const badPdf = await engine.processDocument({
    id: "doc_bad_pdf_1",
    sourceType: "PDF",
    filename: "bad.pdf",
    content: Buffer.from("not a real pdf"),
  });
  assert.equal(badPdf.processingStatus, "FAILED");
  assert.ok(badPdf.warnings.some((w) => /PDF parsing failed/i.test(w)));
});

