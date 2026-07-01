function normalizeText(text) {
  return String(text ?? "").toLowerCase();
}

const BUSINESS_AREA_RULES = [
  { area: "Sales", keywords: ["sales", "quote", "pricing", "deal", "proposal", "lead"] },
  { area: "Operations", keywords: ["operations", "process", "workflow", "sop", "procedure", "steps"] },
  { area: "Legal", keywords: ["policy", "policies", "compliance", "regulation", "legal", "contract"] },
  { area: "Finance", keywords: ["price", "pricing", "cost", "fee", "budget", "$"] },
  { area: "Maintenance", keywords: ["maintenance", "repair", "fix", "service"] },
  { area: "Leasing", keywords: ["lease", "rent", "tenant", "tenancy", "move-in"] },
  { area: "CustomerSupport", keywords: ["support", "faq", "help", "customer service", "ticket"] },
  { area: "Marketing", keywords: ["marketing", "campaign", "newsletter", "promotion"] },
  { area: "Administration", keywords: ["administration", "employee", "handbook", "roles", "time off"] },
];

export class BusinessAreaClassifier {
  classify({ processedDocument } = {}) {
    const title = processedDocument?.title ?? "";
    const headings = Array.isArray(processedDocument?.headings)
      ? processedDocument.headings
      : [];
    const plainText = processedDocument?.plainText ?? "";

    const haystack = normalizeText(`${title}\n${headings.join(" ")}\n${plainText}`);

    const signals = [];
    for (const rule of BUSINESS_AREA_RULES) {
      let score = 0;
      for (const kw of rule.keywords) {
        if (kw && haystack.includes(String(kw).toLowerCase())) score += 3;
      }
      if (score > 0) signals.push({ area: rule.area, score });
    }

    signals.sort((a, b) => b.score - a.score || a.area.localeCompare(b.area));
    const businessAreas = signals.slice(0, 3).map((s) => s.area);

    return {
      businessAreas,
      areaSignals: signals,
    };
  }
}

