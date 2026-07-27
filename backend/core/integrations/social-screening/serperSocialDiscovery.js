/**
 * Serper Google search — discover public social profiles for a subject.
 */
const NETWORK_QUERIES = Object.freeze([
  { network: "linkedin", query: (name) => `"${name}" site:linkedin.com/in` },
  { network: "x", query: (name) => `"${name}" (site:x.com OR site:twitter.com)` },
  { network: "instagram", query: (name) => `"${name}" site:instagram.com` },
  { network: "facebook", query: (name) => `"${name}" site:facebook.com` },
  { network: "tiktok", query: (name) => `"${name}" site:tiktok.com` },
  { network: "youtube", query: (name) => `"${name}" site:youtube.com` },
]);

export async function discoverSocialProfiles({
  subject = {},
  serperApiKey,
  networks = null,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  maxPerNetwork = 3,
} = {}) {
  const name = String(subject.name ?? "").trim();
  const handles = Array.isArray(subject.handles)
    ? subject.handles.map(String).filter(Boolean)
    : [];
  if (!serperApiKey) {
    return { ok: false, reason: "serper_api_key_missing", profiles: [], searches: [] };
  }
  if (!name && handles.length === 0) {
    return { ok: false, reason: "subject_name_required", profiles: [], searches: [] };
  }
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "fetch_unavailable", profiles: [], searches: [] };
  }

  const wanted = Array.isArray(networks) && networks.length
    ? NETWORK_QUERIES.filter((n) => networks.map(String).map((x) => x.toLowerCase()).includes(n.network))
    : NETWORK_QUERIES;

  const searches = [];
  const profiles = [];
  const seen = new Set();

  for (const handle of handles.slice(0, 6)) {
    const q = String(handle).replace(/^@/, "");
    searches.push({ network: "handle", query: q });
    // Let Serper resolve handle across the open web
    const rows = await serperSearch({
      query: q,
      apiKey: serperApiKey,
      fetchImpl,
      num: 5,
    });
    for (const row of rows.slice(0, maxPerNetwork)) {
      const url = String(row.link ?? "").trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      profiles.push({
        network: guessNetwork(url),
        title: String(row.title ?? ""),
        url,
        snippet: String(row.snippet ?? ""),
      });
    }
  }

  if (name) {
    for (const entry of wanted) {
      const query = entry.query(name);
      searches.push({ network: entry.network, query });
      const rows = await serperSearch({
        query,
        apiKey: serperApiKey,
        fetchImpl,
        num: maxPerNetwork,
      });
      for (const row of rows) {
        const url = String(row.link ?? "").trim();
        if (!url || seen.has(url)) continue;
        seen.add(url);
        profiles.push({
          network: entry.network,
          title: String(row.title ?? ""),
          url,
          snippet: String(row.snippet ?? ""),
        });
      }
    }
  }

  return { ok: true, profiles, searches };
}

async function serperSearch({ query, apiKey, fetchImpl, num = 5 }) {
  const res = await fetchImpl("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num }),
  });
  if (!res.ok) {
    return [];
  }
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.organic) ? data.organic : [];
}

function guessNetwork(url) {
  const u = String(url).toLowerCase();
  if (u.includes("linkedin.com")) return "linkedin";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("facebook.com")) return "facebook";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("x.com") || u.includes("twitter.com")) return "x";
  return "web";
}
