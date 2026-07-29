/**
 * LLM structured company briefs for prospecting candidates.
 */
import { OpenAIProvider } from "../providers/OpenAIProvider.js";

function safeJsonParse(text) {
  try {
    return JSON.parse(String(text ?? ""));
  } catch {
    return null;
  }
}

/**
 * Demo / offline brief when no live LLM.
 */
export function demoCompanyBrief({ companyName, website, snippet, criteria }) {
  const industry = criteria?.industry || "unknown industry";
  const titles = Array.isArray(criteria?.titles) && criteria.titles.length
    ? criteria.titles
    : ["Owner"];
  return {
    overview: snippet
      ? String(snippet).slice(0, 280)
      : `${companyName} appears relevant for ${industry} prospecting.`,
    sizeEstimate: criteria?.companySizeBand && criteria.companySizeBand !== "unknown"
      ? criteria.companySizeBand
      : "unknown",
    sizeEstimated: true,
    industry: industry === "unknown industry" ? null : industry,
    decisionMakerName: null,
    decisionMakerTitle: titles[0] ?? "Owner",
    sources: website ? [website] : [],
  };
}

/**
 * @returns {Promise<{
 *   overview: string,
 *   sizeEstimate: string,
 *   sizeEstimated: boolean,
 *   industry: string|null,
 *   decisionMakerName: string|null,
 *   decisionMakerTitle: string|null,
 *   sources: string[],
 * }>}
 */
export async function generateCompanyBrief({
  company,
  criteria,
  llmProvider = null,
} = {}) {
  const companyName = String(company?.companyName ?? "Company").trim();
  const website = String(company?.website ?? "").trim() || null;
  const snippet = String(company?.snippet ?? "").trim();

  const provider = llmProvider
    ?? new OpenAIProvider({
      mode: process.env.OPENAI_API_KEY ? "live" : "demo",
    });

  if (provider.mode === "demo" || !process.env.OPENAI_API_KEY) {
    return demoCompanyBrief({ companyName, website, snippet, criteria });
  }

  const titles = Array.isArray(criteria?.titles) ? criteria.titles.join(", ") : "Owner, Founder";
  const prompt = [
    "You research B2B companies for sales prospecting from PUBLIC search text only.",
    "Return JSON only with keys: overview, sizeEstimate, sizeEstimated (boolean), industry,",
    "decisionMakerName, decisionMakerTitle, sources (string url array).",
    "overview must be a short 1–2 sentence brief.",
    "Hard rules: Do NOT invent email, phone, or a person name.",
    "decisionMakerName: only if a real person name appears in the search text; otherwise null (company name will be used).",
    "Mark sizeEstimated true when size is inferred.",
    "",
    `Company: ${companyName}`,
    `Website: ${website ?? "unknown"}`,
    `Public search text: ${snippet || "none"}`,
    `Target industry: ${criteria?.industry || "unspecified"}`,
    `Target geo: ${criteria?.geo || "unspecified"}`,
    `Preferred titles: ${titles}`,
  ].join("\n");

  try {
    const text = await provider.generate(prompt, { json: true, temperature: 0.2 });
    const parsed = safeJsonParse(text);
    if (!parsed || typeof parsed !== "object") {
      return demoCompanyBrief({ companyName, website, snippet, criteria });
    }
    return {
      overview: String(parsed.overview ?? snippet ?? "").trim().slice(0, 500)
        || demoCompanyBrief({ companyName, website, snippet, criteria }).overview,
      sizeEstimate: String(parsed.sizeEstimate ?? "unknown").trim().slice(0, 40) || "unknown",
      sizeEstimated: parsed.sizeEstimated !== false,
      industry: parsed.industry ? String(parsed.industry).trim().slice(0, 80) : (criteria?.industry || null),
      decisionMakerName: parsed.decisionMakerName
        ? String(parsed.decisionMakerName).trim().slice(0, 120)
        : null,
      decisionMakerTitle: parsed.decisionMakerTitle
        ? String(parsed.decisionMakerTitle).trim().slice(0, 80)
        : (Array.isArray(criteria?.titles) ? criteria.titles[0] : "Owner"),
      sources: Array.isArray(parsed.sources)
        ? parsed.sources.map((s) => String(s).trim()).filter(Boolean).slice(0, 8)
        : (website ? [website] : []),
    };
  } catch {
    return demoCompanyBrief({ companyName, website, snippet, criteria });
  }
}
