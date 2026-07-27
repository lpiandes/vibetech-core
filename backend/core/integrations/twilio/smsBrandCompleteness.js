/**
 * Shared SMS brand/A2P field completeness — safe for client + server (no Twilio API).
 */
function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

/**
 * @param {Record<string, unknown>} [input]
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function evaluateSmsBrandCompleteness(input = {}) {
  const legalBusinessName = safeString(input.legalBusinessName || input.businessName);
  const website = safeString(input.website || input.websiteUrl);
  const ein = safeString(input.ein || input.taxId || input.businessRegistrationNumber);
  const businessType = safeString(input.businessType || "LLC");
  const businessIndustry = safeString(input.businessIndustry || input.vertical || "HEALTHCARE");
  const addressLine1 = safeString(input.addressLine1 || input.street);
  const city = safeString(input.city);
  const region = safeString(input.region || input.state);
  const postalCode = safeString(input.postalCode || input.zip);
  const contactFirstName = safeString(input.contactFirstName || input.firstName);
  const contactLastName = safeString(input.contactLastName || input.lastName);
  const contactEmail = safeString(input.contactEmail || input.email || input.brandContactEmail);
  const contactPhone = safeString(input.contactPhone || input.phoneNumber);
  const sample1 = safeString(input.messageSample1 || (Array.isArray(input.messageSamples) ? input.messageSamples[0] : ""));
  const sample2 = safeString(input.messageSample2 || (Array.isArray(input.messageSamples) ? input.messageSamples[1] : ""));
  const messageSamples = [sample1, sample2].filter(Boolean);
  const messageFlow = safeString(input.messageFlow || input.optInDescription);

  const missing = [];
  if (!legalBusinessName) missing.push("legalBusinessName");
  if (!ein) missing.push("ein");
  if (!website) missing.push("website");
  if (!businessType) missing.push("businessType");
  if (!businessIndustry) missing.push("businessIndustry");
  if (!addressLine1) missing.push("addressLine1");
  if (!city) missing.push("city");
  if (!region) missing.push("region");
  if (!postalCode) missing.push("postalCode");
  if (!contactFirstName) missing.push("contactFirstName");
  if (!contactLastName) missing.push("contactLastName");
  if (!contactEmail) missing.push("contactEmail");
  if (!contactPhone) missing.push("contactPhone");
  if (messageSamples.length < 2) missing.push("messageSamples");
  if (!messageFlow || messageFlow.length < 40) missing.push("messageFlow");

  return { ok: missing.length === 0, missing };
}

export function isSmsBrandComplete(brand = {}) {
  return evaluateSmsBrandCompleteness(brand).ok === true;
}
