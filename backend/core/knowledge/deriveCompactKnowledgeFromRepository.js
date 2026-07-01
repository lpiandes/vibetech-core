/**
 * Compatibility derivation layer:
 * runtime.getKnowledge() historically returned a compact shape used by CompanyBrain/BrainSearch.
 *
 * Knowledge OS (repository) is canonical, but we still expose the legacy compact contract
 * as a derived view so existing employees keep working.
 */

function pickItemsByCategory(repository, category) {
  const items = Array.isArray(repository?.items) ? repository.items : [];
  return items.filter((i) => i.category === category && i.status !== "ARCHIVED");
}

function takeAllDescriptions(items) {
  return items.map((i) => String(i.description ?? ""));
}

export function deriveCompactKnowledgeFromRepository(repository) {
  // Legacy compatibility contract:
  // - runtime.getKnowledge() historically returned:
  //   faqs, listingPolicies, responsePreferences, brandVoice, propertyShowingRules
  //
  // Knowledge OS now uses category IDs. We map legacy compact fields deterministically
  // from repository items + their tags.
  const FAQ_CATEGORY = "FAQ";
  const POLICIES_CATEGORY = "POLICIES";
  const BRAND_VOICE_CATEGORY = "BRAND_VOICE";
  const PROPERTY_INFO_CATEGORY = "PROPERTY_INFORMATION";

  const faqs = pickItemsByCategory(repository, FAQ_CATEGORY).map((i) => ({
    question: String(i.title ?? ""),
    answer: String(i.description ?? ""),
  }));

  const policiesItems = pickItemsByCategory(repository, POLICIES_CATEGORY);

  const listingPolicies = policiesItems
    .filter((i) => Array.isArray(i.tags) && i.tags.includes("listing"))
    .map((i) => String(i.description ?? ""));

  const responsePreferences = policiesItems
    .filter((i) => Array.isArray(i.tags) && i.tags.includes("preference"))
    .map((i) => String(i.description ?? ""));

  const brandVoiceItems = pickItemsByCategory(repository, BRAND_VOICE_CATEGORY);
  const brandVoice = brandVoiceItems.length ? String(brandVoiceItems[0]?.description ?? "") : "";

  const propertyShowingRules = pickItemsByCategory(
    repository,
    PROPERTY_INFO_CATEGORY,
  ).map((i) => String(i.description ?? ""));

  return {
    faqs,
    listingPolicies,
    responsePreferences,
    brandVoice,
    propertyShowingRules,
  };
}

