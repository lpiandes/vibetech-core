import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Provider boundary for public business research.
 * Core does not scrape the open web. Adapters may call approved research services later.
 */
export class BusinessResearchProvider {
  async researchBusiness({ websiteUrl, businessName = null, nowISO = new Date().toISOString() } = {}) {
    const url = String(websiteUrl ?? "").trim();
    if (!url) {
      return deepFreeze({
        ok: false,
        reason: "website_url_required",
        result: null,
      });
    }

    // Deterministic stub evidence — not live crawling.
    return deepFreeze({
      ok: true,
      provider: "stub_research_boundary",
      result: {
        businessName: businessName || guessNameFromUrl(url),
        services: [],
        locations: [],
        teamMembers: [],
        terminology: [],
        contactChannels: ["email"],
        businessHours: null,
        faqs: [],
        publicPolicies: [],
        detectedSystems: [],
        confidence: 0.35,
        sourceReferences: [{ url, retrievedAt: nowISO }],
        retrievedAt: nowISO,
        notes: "Research is evidence only. Confirm details during discovery before install.",
      },
    });
  }
}

function guessNameFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".")[0] ?? host;
  } catch {
    return null;
  }
}
