/**
 * Pluggable contact enrichment for prospecting.
 * No-op / public-only when keys missing; Apollo or Hunter when env/secrets present.
 */

function trim(value) {
  return String(value ?? "").trim();
}

export function readEnrichmentKeys({ env = process.env, secrets = null } = {}) {
  const fromSecrets = secrets && typeof secrets === "object" ? secrets : {};
  const apolloApiKey = trim(
    fromSecrets.apolloApiKey
      ?? fromSecrets.APOLLO_API_KEY
      ?? env.APOLLO_API_KEY
      ?? "",
  );
  const hunterApiKey = trim(
    fromSecrets.hunterApiKey
      ?? fromSecrets.HUNTER_API_KEY
      ?? env.HUNTER_API_KEY
      ?? "",
  );
  return {
    apolloApiKey,
    hunterApiKey,
    ready: Boolean(apolloApiKey || hunterApiKey),
    provider: apolloApiKey ? "apollo" : (hunterApiKey ? "hunter" : null),
  };
}

/**
 * Pattern-guess a corporate email without claiming verification.
 */
export function guessEmailPattern({ firstName, lastName, domain }) {
  const domainClean = trim(domain).replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  const first = trim(firstName).toLowerCase().replace(/[^a-z]/g, "");
  const last = trim(lastName).toLowerCase().replace(/[^a-z]/g, "");
  if (!domainClean || !first) return null;
  if (last) return `${first}.${last}@${domainClean}`;
  return `${first}@${domainClean}`;
}

function domainFromWebsite(website) {
  const raw = trim(website).replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  return raw.toLowerCase() || null;
}

function splitName(fullName) {
  const parts = trim(fullName).split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : "",
  };
}

async function enrichViaApollo({ apiKey, companyName, domain, decisionMakerName, title, fetchImpl }) {
  const body = {
    api_key: apiKey,
    q_organization_domains: domain ? [domain] : undefined,
    q_organization_name: companyName || undefined,
    person_titles: title ? [title] : undefined,
    q_person_name: decisionMakerName || undefined,
    page: 1,
    per_page: 1,
  };
  const res = await fetchImpl("https://api.apollo.io/v1/mixed_people/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  const person = Array.isArray(data.people) ? data.people[0] : null;
  if (!person) return null;
  const email = trim(person.email);
  const phone = trim(person.phone_numbers?.[0]?.sanitized_number ?? person.phone_number ?? "");
  return {
    email: email
      ? {
        value: email,
        confidence: person.email_status === "verified" ? "high" : "medium",
        source: "apollo",
        verified: person.email_status === "verified",
      }
      : null,
    phone: phone
      ? {
        value: phone,
        confidence: "medium",
        source: "apollo",
        verified: false,
      }
      : null,
    provider: "apollo",
    costMeta: { provider: "apollo", units: 1 },
  };
}

async function enrichViaHunter({ apiKey, domain, decisionMakerName, fetchImpl }) {
  if (!domain) return null;
  const { firstName, lastName } = splitName(decisionMakerName);
  const params = new URLSearchParams({
    domain,
    api_key: apiKey,
  });
  if (firstName) params.set("first_name", firstName);
  if (lastName) params.set("last_name", lastName);
  const res = await fetchImpl(`https://api.hunter.io/v2/email-finder?${params}`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  const email = trim(data?.data?.email);
  if (!email) return null;
  const score = Number(data?.data?.score ?? 0);
  return {
    email: {
      value: email,
      confidence: score >= 80 ? "high" : score >= 50 ? "medium" : "low",
      source: "hunter",
      verified: score >= 80,
    },
    phone: null,
    provider: "hunter",
    costMeta: { provider: "hunter", units: 1 },
  };
}

/**
 * Enrich a prospecting candidate contact. Never invents verified phones/emails.
 * @returns {Promise<{
 *   email: object|null,
 *   phone: object|null,
 *   provider: string|null,
 *   costMeta: object|null,
 * }>}
 */
export async function enrichProspectContact({
  candidate,
  env = process.env,
  secrets = null,
  fetchImpl = globalThis.fetch?.bind(globalThis),
} = {}) {
  const keys = readEnrichmentKeys({ env, secrets });
  const domain = domainFromWebsite(candidate?.website);
  const name = trim(candidate?.decisionMakerName);
  const title = trim(candidate?.decisionMakerTitle);
  const companyName = trim(candidate?.companyName);

  if (keys.apolloApiKey && typeof fetchImpl === "function") {
    try {
      const hit = await enrichViaApollo({
        apiKey: keys.apolloApiKey,
        companyName,
        domain,
        decisionMakerName: name,
        title,
        fetchImpl,
      });
      if (hit) return hit;
    } catch {
      /* fall through */
    }
  }

  if (keys.hunterApiKey && typeof fetchImpl === "function") {
    try {
      const hit = await enrichViaHunter({
        apiKey: keys.hunterApiKey,
        domain,
        decisionMakerName: name,
        fetchImpl,
      });
      if (hit) return hit;
    } catch {
      /* fall through */
    }
  }

  // Public-only / pattern guess — always unmarked as verified
  const { firstName, lastName } = splitName(name);
  const guessed = guessEmailPattern({ firstName, lastName, domain });
  return {
    email: guessed
      ? {
        value: guessed,
        confidence: "low",
        source: "pattern_guess",
        verified: false,
      }
      : null,
    phone: null,
    provider: null,
    costMeta: { provider: "none", units: 0 },
  };
}

export { domainFromWebsite, splitName };
