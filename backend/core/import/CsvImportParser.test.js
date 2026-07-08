import assert from "node:assert/strict";
import { test } from "node:test";

import { CsvImportParser } from "./parsers/CsvImportParser.js";

test("CsvImportParser parses headers and rows", async () => {
  const csv = Buffer.from(`Contact Id,Email,First Name,Last Name
123,jane@example.com,Jane,Doe
456,"bob@example.com",Bob,"Smith, Jr."`);

  const parser = new CsvImportParser();
  const result = await parser.parse(csv);

  assert.deepEqual(result.columns, ["Contact Id", "Email", "First Name", "Last Name"]);
  assert.equal(result.rowCount, 2);
  assert.equal(result.rows[0]["Contact Id"], "123");
  assert.equal(result.rows[0].Email, "jane@example.com");
  assert.equal(result.rows[1]["Last Name"], "Smith, Jr.");
});

test("CsvImportParser skips empty rows", async () => {
  const csv = Buffer.from(`Email\na@example.com\n\n\nb@example.com\n`);
  const parser = new CsvImportParser();
  const result = await parser.parse(csv);
  assert.equal(result.rowCount, 2);
});
