/**
 * Discover company candidates via Serper organic search.
 */
import { serperSearch } from "../integrations/social-screening/serperSocialDiscovery.js";
import { buildDiscoveryQuery, normalizeProspectingCriteria } from "./ProspectingCriteria.js";

function hostnameFromUrl(url) {
  try {
    const u = new URL(String(url ?? "").startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function companyNameFromTitle(title, hostname) {
  const raw = String(title ?? "").trim();
  if (!raw) {
    const host = hostname || "";
    const base = host.split(".")[0] || "Company";
    return base.charAt(0).toUpperCase() + base.slice(1);
  }
  // Strip common suffix noise: "Acme Inc - Home" → "Acme Inc"
  return raw.split(/\s+[|\-–—:]\s+/)[0].trim().slice(0, 120) || raw.slice(0, 120);
}

/**
 * @returns {Promise<Array<{
 *   companyName: string,
 *   website: string|null,
 *   snippet: string,
 *   sources: string[],
 * }>>}
 */
export async function discoverCompaniesViaSerper({
  criteria,
  apiKey,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  num = 10,
} = {}) {
  const c = normalizeProspectingCriteria(criteria);
  const key = String(apiKey ?? "").trim();
  if (!key || typeof fetchImpl !== "function") return [];

  const query = buildDiscoveryQuery(c);
  const organic = await serperSearch({
    query,
    apiKey: key,
    fetchImpl,
    num: Math.min(20, Math.max(num, c.maxLeads)),
  });

  const seen = new Set();
  const out = [];
  for (const row of organic) {
    const url = String(row?.link ?? row?.url ?? "").trim();
    const hostname = hostnameFromUrl(url);
    if (!hostname || seen.has(hostname)) continue;
    // Skip obvious non-company directories
    if (/(linkedin\.com|facebook\.com|yelp\.com|wikipedia\.org|youtube\.com|twitter\.com|x\.com)/i.test(hostname)) {
      continue;
    }
    seen.add(hostname);
    const title = String(row?.title ?? "").trim();
    const snippet = String(row?.snippet ?? "").trim();
    out.push({
      companyName: companyNameFromTitle(title, hostname),
      website: url ? (url.startsWith("http") ? url : `https://${hostname}`) : `https://${hostname}`,
      snippet,
      sources: url ? [url] : [],
    });
    if (out.length >= c.maxLeads) break;
  }
  return out;
}

export { hostnameFromUrl, companyNameFromTitle };
