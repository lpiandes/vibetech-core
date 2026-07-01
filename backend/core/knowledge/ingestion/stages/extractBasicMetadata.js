function takeFirstNonEmptyLine(lines) {
  for (const l of lines) {
    const t = String(l ?? "").trim();
    if (t.length) return t;
  }
  return "";
}

function extractMarkdownTitle(lines) {
  const first = takeFirstNonEmptyLine(lines);
  if (!first) return "";
  const m = first.match(/^#+\s+(.*)$/);
  return m ? m[1].trim() : "";
}

function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function uniquePreserveOrder(arr) {
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function removeStopwords(tokens) {
  const stop = new Set([
    "the",
    "and",
    "or",
    "to",
    "a",
    "of",
    "in",
    "for",
    "on",
    "with",
    "is",
    "are",
    "be",
    "as",
    "at",
    "by",
    "from",
    "an",
  ]);
  return tokens.filter((t) => !stop.has(t));
}

function estimateConfidence(text) {
  // Deterministic heuristic.
  const len = String(text ?? "").length;
  if (len >= 1200) return 0.85;
  if (len >= 400) return 0.75;
  return 0.6;
}

export function extractBasicMetadata({
  sourceType,
  filename,
  normalizedText,
} = {}) {
  const lines = String(normalizedText ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

  const markdownTitle =
    sourceType === "MARKDOWN" ? extractMarkdownTitle(lines) : "";

  const titleCandidate = markdownTitle || takeFirstNonEmptyLine(lines);
  const title = titleCandidate ? titleCandidate.slice(0, 120) : "Untitled knowledge";

  // Basic deterministic extraction:
  // - take the first non-empty line as title (or markdown heading stripped)
  // - the description becomes the remaining content (if any)
  const restLines = lines.slice(1);
  const restText = restLines.join(" ").trim();
  const description =
    restText.length > 0 ? restText.slice(0, 180) : String(normalizedText ?? "").slice(0, 180);

  const tokens = removeStopwords(tokenize(`${title} ${description}`));
  const tags = uniquePreserveOrder(tokens).slice(0, 6);
  const searchKeywords = tokens.slice(0, 12);

  const warnings = [];
  if (!titleCandidate) warnings.push("Title could not be detected; using default title.");

  return {
    title,
    description,
    tags,
    searchKeywords,
    confidence: estimateConfidence(normalizedText),
    metadata: {
      filename,
      sourceType,
      charCount: String(normalizedText ?? "").length,
      lineCount: lines.length,
    },
    warnings,
  };
}

