import { ImportParser } from "./ImportParser.js";

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result.map((cell) => cell.trim());
}

function splitCsvRows(text) {
  const rows = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      if (current.trim()) rows.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) rows.push(current);
  return rows;
}

export class CsvImportParser extends ImportParser {
  async parse(buffer, { sampleLimit = 5 } = {}) {
    const text = Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer ?? "");
    const lines = splitCsvRows(text.replace(/^\uFEFF/, ""));
    if (!lines.length) {
      return { columns: [], rows: [], sampleRows: [], rowCount: 0 };
    }

    const columns = parseCsvLine(lines[0]).map((c) => String(c ?? "").trim());
    const rows = [];
    for (let i = 1; i < lines.length; i += 1) {
      const values = parseCsvLine(lines[i]);
      if (values.every((v) => !String(v).trim())) continue;
      const record = {};
      for (let c = 0; c < columns.length; c += 1) {
        record[columns[c]] = values[c] ?? "";
      }
      rows.push(record);
    }

    return {
      columns,
      rows,
      sampleRows: rows.slice(0, sampleLimit),
      rowCount: rows.length,
    };
  }
}
