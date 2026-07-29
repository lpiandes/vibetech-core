/**
 * Free contact discovery: Serper queries that surface public phone/email in snippets.
 */
import { serperSearch } from "../integrations/social-screening/serperSocialDiscovery.js";
import { extractPublicContactFields, hostnameFromUrl } from "./publicContactExtract.js";

/**
 * Search for public contact info for a company (phone preferred).
 * Collects all phones/emails and ranks most relevant first.
 * @returns {Promise<{
 *   phone: object|null,
 *   email: object|null,
 *   phones: object[],
 *   emails: object[],
 *   texts: string[],
 *   sources: string[],
 *   serperQueries: number,
 * }>}
 */
export async function discoverPublicContactDetails({
  company,
  criteria = {},
  apiKey,
  fetchImpl = globalThis.fetch?.bind(globalThis),
} = {}) {
  const key = String(apiKey ?? "").trim();
  const name = String(company?.companyName ?? "").trim();
  const website = String(company?.website ?? "").trim();
  const geo = String(criteria?.geo ?? "").trim();
  if (!key || !name || typeof fetchImpl !== "function") {
    return {
      phone: null,
      email: null,
      phones: [],
      emails: [],
      texts: [],
      sources: [],
      serperQueries: 0,
    };
  }

  const companyHost = hostnameFromUrl(website);

  const queries = [
    `"${name}"${geo ? ` ${geo}` : ""} (phone OR call OR "contact us" OR tel OR appointment)`,
    companyHost ? `site:${companyHost} (phone OR contact OR email OR call OR appointment)` : null,
  ].filter(Boolean);

  /** @type {Array<{ text: string, url: string }>} */
  const evidence = [];
  if (company?.snippet) {
    evidence.push({ text: String(company.snippet), url: website || "" });
  }
  if (name) evidence.push({ text: name, url: website || "" });

  const sources = [...(company?.sources ?? [])];
  let serperQueries = 0;

  for (const query of queries) {
    const organic = await serperSearch({
      query,
      apiKey: key,
      fetchImpl,
      num: 8,
    });
    serperQueries += 1;
    for (const row of organic) {
      const title = String(row?.title ?? "").trim();
      const snippet = String(row?.snippet ?? "").trim();
      const url = String(row?.link ?? row?.url ?? "").trim();
      if (title) evidence.push({ text: title, url });
      if (snippet) evidence.push({ text: snippet, url });
      if (url) sources.push(url);
    }
  }

  const found = extractPublicContactFields(evidence, {
    companyHost,
    geo,
    source: "serper_snippet",
  });

  return {
    ...found,
    texts: evidence.map((e) => e.text),
    sources: [...new Set(sources)],
    serperQueries,
  };
}
