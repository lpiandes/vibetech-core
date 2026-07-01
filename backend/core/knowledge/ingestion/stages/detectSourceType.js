function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`detectSourceType: expected ${name} to be a non-empty string.`);
  }
}

function getExtension(filename) {
  const parts = String(filename).split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

const SUPPORTED_EXTENSIONS = {
  txt: "TXT",
  markdown: "MARKDOWN",
  md: "MARKDOWN",
  html: "HTML",
  htm: "HTML",
  // detected but intentionally not parsed in this sprint:
  docx: "DOCX",
  pdf: "PDF",
};

export function detectSourceType({ filename, sourceType } = {}) {
  if (sourceType && typeof sourceType === "string") {
    return { sourceType: String(sourceType) };
  }

  requiredString(filename, "filename");
  const ext = getExtension(filename);
  const detected = SUPPORTED_EXTENSIONS[ext];

  if (!detected) {
    throw new Error(`detectSourceType: unsupported extension: ${ext}`);
  }

  return { sourceType: detected };
}

