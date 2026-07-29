/**
 * Free contact discovery: Serper queries that surface public phone/email in snippets.
 */
import { serperSearch } from "../integrations/social-screening/serperSocialDiscovery.js";
import { extractPublicContactFields } from "./publicContactExtract.js";

/**
 * Search for public contact info for a company (phone preferred).
 * @returns {Promise<{
 *   phone: object|null,
 *   email: object|null,
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
    return { phone: null, email: null, texts: [], sources: [], serperQueries: 0 };
  }

  let host = "";
  try {
    host = new URL(website.startsWith("http") ? website : `https://${website}`).hostname;
  } catch {
    host = "";
  }

  const queries = [
    `"${name}"${geo ? ` ${geo}` : ""} (phone OR call OR "contact us" OR tel)`,
    host ? `site:${host} (phone OR contact OR email OR call)` : null,
  ].filter(Boolean);

  const texts = [String(company?.snippet ?? ""), String(company?.companyName ?? "")];
  const sources = [...(company?.sources ?? [])];
  let serperQueries = 0;

  for (const query of queries) {
    const organic = await serperSearch({
      query,
      apiKey: key,
      fetchImpl,
      num: 5,
    });
    serperQueries += 1;
    for (const row of organic) {
      const title = String(row?.title ?? "").trim();
      const snippet = String(row?.snippet ?? "").trim();
      const url = String(row?.link ?? row?.url ?? "").trim();
      if (title) texts.push(title);
      if (snippet) texts.push(snippet);
      if (url) sources.push(url);
    }
    const found = extractPublicContactFields(texts, { source: "serper_snippet" });
    if (found.phone) {
      return {
        ...found,
        texts,
        sources: [...new Set(sources)],
        serperQueries,
      };
    }
  }

  const found = extractPublicContactFields(texts, { source: "serper_snippet" });
  return {
    ...found,
    texts,
    sources: [...new Set(sources)],
    serperQueries,
  };
}
