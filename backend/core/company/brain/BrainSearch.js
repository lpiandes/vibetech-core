/**
 * BrainSearch (v1)
 *
 * Deterministically gathers information from:
 * - Company Data
 * - Company Knowledge (FAQs, listing policies, response preferences, brand voice)
 * - Company Policies (approval rules)
 *
 * No embeddings yet. No vector DB.
 */

function safeString(v) {
  return v === undefined || v === null ? "" : String(v);
}

function extractKeywords(message) {
  const msg = safeString(message).toLowerCase();
  const tokens = msg
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  // Stable set of relevant cues for property management.
  const cues = [
    "walkthrough",
    "tour",
    "schedule",
    "timing",
    "window",
    "hoa",
    "zoning",
    "timeline",
    "next",
    "steps",
    "urgent",
    "asap",
    "today",
    "immediately",
  ];

  const present = cues.filter((c) => msg.includes(c));
  return { tokens, presentCues: present };
}

function rankFaqs(faqs, message) {
  const { presentCues } = extractKeywords(message);

  if (!Array.isArray(faqs) || !faqs.length) return [];

  const scored = faqs.map((f) => {
    const q = safeString(f?.question).toLowerCase();
    const a = safeString(f?.answer).toLowerCase();

    let score = 0;
    for (const cue of presentCues) {
      if (q.includes(cue)) score += 3;
      if (a.includes(cue)) score += 2;
    }

    // Small baseline to keep ordering stable.
    score += 0.1;
    return { faq: f, score };
  });

  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, 4).map((s) => s.faq);
}

function summarizeStructured({ property, inquiry }) {
  const propertyAddress = property?.address ?? "";
  const buyerMessage = inquiry?.message ?? "";
  const priority = inquiry?.priority ?? "";

  const summaryBits = [];
  if (propertyAddress) summaryBits.push(`Focus on ${propertyAddress}.`);
  if (priority) summaryBits.push(`Priority: ${priority}.`);
  if (buyerMessage) summaryBits.push(`Buyer message: ${safeString(buyerMessage).slice(0, 120)}.`);

  return summaryBits.join(" ");
}

export class BrainSearch {
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("BrainSearch requires runtime.");
    this.runtime = runtime;
  }

  search({ task, relatedEntities }) {
    const companyData = this.runtime.getCompanyData?.() ?? {};
    const knowledge = this.runtime.getKnowledge?.() ?? {};
    const approvalRules = this.runtime.getApprovalRules?.() ?? [];

    const propertyId =
      relatedEntities?.property?.propertyId ??
      relatedEntities?.propertyId ??
      "";

    const property = propertyId
      ? (companyData.properties ?? []).find((p) => p.propertyId === propertyId)
      : relatedEntities?.property ?? null;

    const buyerInquiry = relatedEntities?.buyerInquiry ?? relatedEntities?.inquiry ?? null;

    const message = buyerInquiry?.message ?? relatedEntities?.message ?? "";
    const relevantDocuments = rankFaqs(knowledge.faqs, message);

    const relevantPolicies = [
      ...(Array.isArray(knowledge.listingPolicies) ? knowledge.listingPolicies : []),
      ...(Array.isArray(approvalRules) ? approvalRules.map((r) => r.description).filter(Boolean) : []),
      ...(Array.isArray(knowledge.responsePreferences) ? knowledge.responsePreferences : []),
    ];

    const brandVoice = knowledge.brandVoice ?? "";

    const operationalRules = {
      responsePreferences: Array.isArray(knowledge.responsePreferences)
        ? knowledge.responsePreferences
        : [],
      propertyShowingRules: Array.isArray(knowledge.propertyShowingRules)
        ? knowledge.propertyShowingRules
        : [],
      task,
    };

    const historicalMemory = {
      note: "placeholder: future retrieval from activity/review history",
      items: [],
    };

    const summary = summarizeStructured({ property, inquiry: buyerInquiry });

    const confidence = (() => {
      const docsScore = relevantDocuments.length ? 0.35 : 0.1;
      const policiesScore = relevantPolicies.length ? 0.35 : 0.1;
      const structureScore = property || buyerInquiry ? 0.3 : 0.05;
      return Math.min(0.99, docsScore + policiesScore + structureScore);
    })();

    return {
      structuredData: {
        property: property ?? undefined,
        buyerInquiry: buyerInquiry ?? undefined,
      },
      relevantDocuments,
      relevantPolicies,
      brandVoice,
      operationalRules,
      historicalMemory,
      summary,
      confidence,
    };
  }
}

