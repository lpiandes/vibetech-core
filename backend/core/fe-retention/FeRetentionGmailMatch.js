/**
 * Match carrier Gmail notices to FE clients. Reused by lapse pass + tests.
 */
function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

export function normalizeFeEmail(email) {
  return safeString(email).toLowerCase();
}

export function digitsOnly(value) {
  return safeString(value).replace(/\D/g, "");
}

/**
 * Score a client against a Gmail message. Highest score wins; 0 = no match.
 */
export function scoreFeClientAgainstNotice(client, message) {
  const fromEmail = normalizeFeEmail(message?.from?.email || message?.from);
  const subject = safeString(message?.subject);
  const snippet = safeString(message?.snippet || message?.bodyText || message?.body);
  const hay = `${subject}\n${snippet}`.toLowerCase();
  const hayDigits = digitsOnly(`${subject} ${snippet}`);
  let score = 0;

  const policyNumber = safeString(client?.policy?.policyNumber);
  if (policyNumber) {
    const pn = policyNumber.toLowerCase();
    if (hay.includes(pn)) score += 100;
    const last4 = digitsOnly(policyNumber).slice(-4);
    if (last4.length === 4 && hayDigits.includes(last4)) score += 40;
  }

  const email = normalizeFeEmail(client?.email);
  if (email && (fromEmail === email || hay.includes(email))) score += 80;

  const phone = digitsOnly(client?.phone);
  if (phone.length >= 10 && hayDigits.includes(phone.slice(-10))) score += 70;

  const name = safeString(client?.name).toLowerCase();
  if (name.length >= 4 && hay.includes(name)) score += 50;
  else {
    const tokens = name.split(/\s+/).filter((t) => t.length >= 3);
    const hits = tokens.filter((t) => hay.includes(t)).length;
    if (tokens.length >= 2 && hits >= 2) score += 35;
  }

  return score;
}

export function findFeClientForCarrierNotice(clients, message) {
  let best = null;
  let bestScore = 0;
  for (const client of clients ?? []) {
    const score = scoreFeClientAgainstNotice(client, message);
    if (score > bestScore) {
      best = client;
      bestScore = score;
    }
  }
  // Require a real identifier hit — name-only below 35 is too weak at scale.
  if (bestScore < 35) return null;
  return best;
}
