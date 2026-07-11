import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Extract evidence-backed signals from HTML/text.
 * Uncertainty is labeled — never silently promoted to facts.
 */
export function extractWebsiteEvidence({
  url,
  html = "",
  text = "",
  retrievedAt = new Date().toISOString(),
} = {}) {
  const blob = `${text}\n${stripTags(html)}`.slice(0, 200_000);
  const lower = blob.toLowerCase();

  const services = unique([
    ...matchList(blob, /(?:services?|we offer|our services)[:\s]+([^\n.]{8,120})/gi),
    ...(lower.includes("leasing") ? ["leasing"] : []),
    ...(lower.includes("maintenance") ? ["maintenance"] : []),
    ...(lower.includes("cleaning") || lower.includes("dental") ? ["cleanings"] : []),
    ...(lower.includes("practice") && lower.includes("hockey") ? ["practices"] : []),
  ]);

  const customerTypes = unique([
    ...(lower.includes("patient") ? ["patient"] : []),
    ...(lower.includes("resident") || lower.includes("tenant") ? ["resident"] : []),
    ...(lower.includes("owner") && lower.includes("propert") ? ["owner"] : []),
    ...(lower.includes("parent") ? ["parent"] : []),
    ...(lower.includes("player") ? ["player"] : []),
  ]);

  const contactMethods = unique([
    ...(/(?:mailto:|email)/i.test(blob) ? ["email"] : []),
    ...(/(?:tel:|phone|call us)/i.test(blob) ? ["phone"] : []),
    ...(lower.includes("contact") ? ["contact_form"] : []),
  ]);

  const locations = unique(matchList(blob, /(?:located in|serving|offices? in)\s+([A-Z][A-Za-z\s,]{2,40})/g));
  const teamMembers = unique(matchList(blob, /(?:dr\.|coach|manager|owner)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g));

  const industrySignals = [];
  if (/propert|leasing|real estate|apartment/i.test(blob)) industrySignals.push("property_management");
  if (/dental|dentist|orthodont|hygien/i.test(blob)) industrySignals.push("dental");
  if (/hockey|travel club|tournament|practice schedule/i.test(blob)) industrySignals.push("sports");

  const findings = {
    companyIdentity: inferTitle(blob, url),
    services,
    teamMembers,
    locations,
    contactMethods,
    terminology: {},
    customerTypes,
    serviceAreas: locations,
    faqs: [],
    policies: [],
    callsToAction: unique(matchList(blob, /\b(book|schedule|contact|get started|request a tour)\b/gi)),
    industrySignals,
  };

  const uncertain = [];
  if (!findings.companyIdentity) uncertain.push("company_identity");
  if (!services.length) uncertain.push("services");
  if (!industrySignals.length) uncertain.push("industry");

  return deepFreeze({
    sourceUrl: String(url),
    retrievedAt: String(retrievedAt),
    findings,
    confidence: Math.max(0.2, 0.85 - uncertain.length * 0.15),
    uncertainFields: uncertain,
    evidenceBacked: true,
    canInstallCapabilities: false,
  });
}

function stripTags(html) {
  return String(html ?? "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ");
}

function matchList(text, regex) {
  const out = [];
  for (const match of String(text).matchAll(regex)) {
    if (match[1]) out.push(String(match[1]).trim());
    else if (match[0]) out.push(String(match[0]).trim());
  }
  return out;
}

function unique(items) {
  return [...new Set(items.map((entry) => String(entry).trim()).filter(Boolean))];
}

function inferTitle(blob, url) {
  const title = blob.match(/^\s*([A-Z][^\n]{3,60})/m)?.[1];
  if (title) return title.trim();
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function createWebsiteResearchReport(extraction, { rejectedFindings = [] } = {}) {
  const findings = { ...extraction.findings };
  for (const key of rejectedFindings) {
    if (Array.isArray(findings[key])) findings[key] = [];
    else if (key in findings) findings[key] = null;
  }
  return deepFreeze({
    ...extraction,
    findings,
    rejectedFindings: deepFreeze(rejectedFindings),
    status: rejectedFindings.length ? "partially_accepted" : "accepted",
  });
}
