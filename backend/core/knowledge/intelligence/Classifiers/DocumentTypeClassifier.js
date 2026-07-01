function normalizeText(text) {
  return String(text ?? "").toLowerCase();
}

const DOC_TYPE_RULES = [
  {
    type: "FAQ",
    keywords: ["faq", "q:", "question", "answer"],
    headings: ["faq"],
  },
  {
    type: "SOP",
    keywords: ["sop", "standard operating procedure", "procedure", "step-by-step", "how to"],
    headings: ["sop", "procedures", "procedure"],
  },
  {
    type: "PRICING",
    keywords: ["price", "pricing", "cost", "$", "fee", "rates"],
    headings: ["pricing", "rates", "fees"],
  },
  {
    type: "POLICIES",
    keywords: ["policy", "policies", "rules", "guidelines", "violation", "confidential", "confidentiality"],
    headings: ["policy", "policies", "rules", "guidelines"],
  },
  {
    type: "BRAND_VOICE",
    keywords: ["brand voice", "tone", "reading level", "greeting", "closing", "emoji policy", "style"],
    headings: ["brand", "tone", "voice"],
  },
  {
    type: "MARKETING",
    keywords: ["marketing", "campaign", "newsletter", "ad copy", "lead", "promotion"],
    headings: ["marketing", "campaigns", "newsletter"],
  },
  {
    type: "DOCUMENTS",
    keywords: ["document", "appendix", "reference", "regulation", "specification"],
    headings: ["documents", "references", "appendix"],
  },
  {
    type: "EMPLOYEE_HANDBOOK",
    keywords: ["handbook", "employee", "welcome", "benefits", "vacation", "time off"],
    headings: ["employee handbook", "handbook"],
  },
  {
    type: "VENDOR_INFORMATION",
    keywords: ["vendor", "supplier", "contractor", "w-9", "1099", "msds"],
    headings: ["vendor", "suppliers", "procurement"],
  },
  {
    type: "COMPLIANCE",
    keywords: ["compliance", "audit", "regulation", "required", "mandatory", "legal", "risk"],
    headings: ["compliance", "audit", "legal"],
  },
];

function scoreRules({ rules, text, headings } = {}) {
  const allText = normalizeText(`${text ?? ""} ${Array.isArray(headings) ? headings.join(" ") : headings ?? ""}`);
  const matched = [];

  for (const rule of rules) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (kw && allText.includes(String(kw).toLowerCase())) score += 3;
    }
    for (const h of rule.headings) {
      if (h && allText.includes(String(h).toLowerCase())) score += 2;
    }
    if (score > 0) matched.push({ type: rule.type, score });
  }

  matched.sort((a, b) => b.score - a.score || a.type.localeCompare(b.type));
  return {
    best: matched[0] ?? null,
    all: matched,
  };
}

export class DocumentTypeClassifier {
  classify({ processedDocument } = {}) {
    const title = processedDocument?.title ?? "";
    const headings = Array.isArray(processedDocument?.headings)
      ? processedDocument.headings
      : [];
    const plainText = processedDocument?.plainText ?? "";

    const scored = scoreRules({
      rules: DOC_TYPE_RULES,
      text: `${title}\n${plainText}`,
      headings,
    });

    const detectedDocumentType = scored.best?.type ?? "General Document";
    const matchedKeywords = scored.best
      ? scored.all
          .find((x) => x.type === scored.best.type)
          ?.score
      : 0;

    return {
      detectedDocumentType,
      typeSignals: scored.all.map((s) => ({ type: s.type, score: s.score })),
      matchedScore: matchedKeywords,
    };
  }
}

