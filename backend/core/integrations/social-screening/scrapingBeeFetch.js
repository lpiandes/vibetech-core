/**
 * ScrapingBee — fetch readable public page text for screening analysis.
 */
export async function fetchPublicPageText({
  url,
  scrapingBeeApiKey,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  maxChars = 6000,
} = {}) {
  const target = String(url ?? "").trim();
  if (!target) return { ok: false, reason: "url_required", text: "" };
  if (!scrapingBeeApiKey) {
    return { ok: false, reason: "scrapingbee_api_key_missing", text: "" };
  }
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "fetch_unavailable", text: "" };
  }

  const endpoint = new URL("https://app.scrapingbee.com/api/v1/");
  endpoint.searchParams.set("api_key", scrapingBeeApiKey);
  endpoint.searchParams.set("url", target);
  endpoint.searchParams.set("render_js", "false");
  endpoint.searchParams.set("extract_rules", JSON.stringify({ text: "body" }));

  const res = await fetchImpl(endpoint.toString(), { method: "GET" });
  if (!res.ok) {
    // Fallback: try plain text without extract_rules
    const plain = new URL("https://app.scrapingbee.com/api/v1/");
    plain.searchParams.set("api_key", scrapingBeeApiKey);
    plain.searchParams.set("url", target);
    plain.searchParams.set("render_js", "false");
    const res2 = await fetchImpl(plain.toString(), { method: "GET" });
    if (!res2.ok) {
      return { ok: false, reason: `scrapingbee_http_${res2.status}`, text: "" };
    }
    const raw = await res2.text();
    return { ok: true, text: stripHtml(raw).slice(0, maxChars) };
  }

  const contentType = String(res.headers.get("content-type") ?? "");
  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => ({}));
    const text = String(data?.text ?? data?.body ?? JSON.stringify(data)).trim();
    return { ok: true, text: text.slice(0, maxChars) };
  }
  const raw = await res.text();
  return { ok: true, text: stripHtml(raw).slice(0, maxChars) };
}

export async function fetchManyPublicPages({
  urls = [],
  scrapingBeeApiKey,
  fetchImpl,
  maxPages = 6,
  maxChars = 5000,
} = {}) {
  const list = (Array.isArray(urls) ? urls : []).map(String).filter(Boolean).slice(0, maxPages);
  const pages = [];
  for (const url of list) {
    const result = await fetchPublicPageText({
      url,
      scrapingBeeApiKey,
      fetchImpl,
      maxChars,
    });
    pages.push({ url, ...result });
  }
  return pages;
}

function stripHtml(html) {
  return String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
