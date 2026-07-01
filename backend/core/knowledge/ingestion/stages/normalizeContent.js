function normalizeNewlines(text) {
  return String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function stripHtmlBasic(html) {
  let s = String(html ?? "");
  // Remove script/style blocks deterministically.
  s = s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  // Remove tags.
  s = s.replace(/<[^>]+>/g, " ");
  return s;
}

function cleanWhitespace(text) {
  return String(text ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+\n/g, "\n\n")
    .trim();
}

function stripMarkdownCodeFences(text) {
  // Basic fenced code block removal.
  return String(text ?? "").replace(/```[\s\S]*?```/g, " ");
}

export function normalizeContent({ sourceType, raw } = {}) {
  let text = normalizeNewlines(raw);

  if (sourceType === "HTML") {
    text = stripHtmlBasic(text);
  } else if (sourceType === "MARKDOWN") {
    text = stripMarkdownCodeFences(text);
  }

  text = cleanWhitespace(text);

  // Split into lines for lightweight structure extraction.
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  return {
    normalizedText: text,
    text,
    lines,
  };
}

