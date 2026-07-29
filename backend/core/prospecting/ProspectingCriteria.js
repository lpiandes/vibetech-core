/**
 * Normalize prospecting run criteria from API / UI input.
 */

export const COMPANY_SIZE_BANDS = Object.freeze([
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "500+",
  "unknown",
]);

/**
 * @param {unknown} raw
 * @returns {{
 *   industry: string,
 *   geo: string,
 *   companySizeBand: string,
 *   keywords: string[],
 *   titles: string[],
 *   maxLeads: number,
 *   pipelineId: string|null,
 *   stageId: string|null,
 * }}
 */
export function normalizeProspectingCriteria(raw = {}) {
  const input = raw && typeof raw === "object" ? raw : {};
  const keywords = Array.isArray(input.keywords)
    ? input.keywords.map((k) => String(k ?? "").trim()).filter(Boolean)
    : String(input.keywords ?? "")
      .split(/[,;]/)
      .map((k) => k.trim())
      .filter(Boolean);
  const titles = Array.isArray(input.titles)
    ? input.titles.map((t) => String(t ?? "").trim()).filter(Boolean)
    : String(input.titles ?? "")
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter(Boolean);

  const size = String(input.companySizeBand ?? input.sizeBand ?? "unknown").trim();
  const maxRaw = Number(input.maxLeads ?? input.limit ?? 10);
  const maxLeads = Number.isFinite(maxRaw) ? Math.min(50, Math.max(1, Math.floor(maxRaw))) : 10;

  return {
    industry: String(input.industry ?? "").trim(),
    geo: String(input.geo ?? input.location ?? "").trim(),
    companySizeBand: COMPANY_SIZE_BANDS.includes(size) ? size : "unknown",
    keywords,
    titles: titles.length ? titles : ["Owner", "Founder", "Practice Manager", "CEO"],
    maxLeads,
    pipelineId: input.pipelineId ? String(input.pipelineId).trim() : null,
    stageId: input.stageId ? String(input.stageId).trim() : null,
  };
}

export function buildDiscoveryQuery(criteria) {
  const c = normalizeProspectingCriteria(criteria);
  const parts = [];
  if (c.industry) parts.push(c.industry);
  if (c.keywords.length) parts.push(c.keywords.join(" "));
  parts.push("companies");
  if (c.geo) parts.push(c.geo);
  if (c.companySizeBand && c.companySizeBand !== "unknown") {
    parts.push(`${c.companySizeBand} employees`);
  }
  return parts.join(" ").trim() || "local businesses";
}
