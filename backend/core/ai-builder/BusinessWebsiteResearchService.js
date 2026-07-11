import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { validateWebsiteUrl, createWebsiteFetchPolicy } from "./WebsiteFetchPolicy.js";
import { extractWebsiteEvidence, createWebsiteResearchReport } from "./WebsiteEvidenceExtractor.js";
import { createBuilderEvidence } from "./BuilderEvidence.js";

/**
 * Safe public website research.
 * Fixture/manual fallback when live fetch is unavailable.
 */
export class BusinessWebsiteResearchService {
  constructor({
    fetchImpl = null,
    policy = createWebsiteFetchPolicy(),
    fixtures = new Map(),
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.policy = policy;
    this.fixtures = fixtures;
  }

  async research({
    websiteUrl,
    approvedUrls = null,
    nowISO = new Date().toISOString(),
    manualFallbackText = null,
  } = {}) {
    const approved = approvedUrls ?? (websiteUrl ? [websiteUrl] : []);
    const validation = validateWebsiteUrl(websiteUrl, { approvedUrls: approved });
    if (!validation.ok) {
      return deepFreeze({
        ok: false,
        reason: validation.reason,
        fallbackAvailable: true,
        message: "We could not research that website. You can paste key details manually.",
      });
    }

    // Fixture path for offline / deterministic proofs
    if (this.fixtures.has(validation.url) || this.fixtures.has(websiteUrl)) {
      const fixture = this.fixtures.get(validation.url) ?? this.fixtures.get(websiteUrl);
      const extraction = extractWebsiteEvidence({
        url: validation.url,
        text: fixture.text ?? "",
        html: fixture.html ?? "",
        retrievedAt: nowISO,
      });
      const report = createWebsiteResearchReport(extraction);
      return deepFreeze({
        ok: true,
        report,
        evidence: createBuilderEvidence({
          evidenceId: `ev_web_${Date.parse(nowISO)}`,
          kind: "website_research",
          label: "Website research",
          source: "fixture",
          confidence: report.confidence,
          payload: report,
          retrievedAt: nowISO,
          mutatesCanonicalData: false,
        }),
      });
    }

    if (!this.fetchImpl) {
      if (manualFallbackText) {
        const extraction = extractWebsiteEvidence({
          url: validation.url,
          text: manualFallbackText,
          retrievedAt: nowISO,
        });
        const report = createWebsiteResearchReport(extraction);
        return deepFreeze({
          ok: true,
          report,
          usedManualFallback: true,
          evidence: createBuilderEvidence({
            evidenceId: `ev_web_manual_${Date.parse(nowISO)}`,
            kind: "website_research",
            label: "Manual website notes",
            source: "manual_fallback",
            confidence: report.confidence,
            payload: report,
            retrievedAt: nowISO,
          }),
        });
      }
      return deepFreeze({
        ok: false,
        reason: "research_unavailable",
        fallbackAvailable: true,
        message: "Website research is unavailable right now. Paste what matters from the site and we will continue.",
      });
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.policy.timeoutMs);
      const response = await this.fetchImpl(validation.url, {
        signal: controller.signal,
        redirect: "follow",
        headers: { accept: "text/html,text/plain" },
      });
      clearTimeout(timer);
      const raw = await response.text();
      const html = String(raw).slice(0, this.policy.maxBytes);
      const extraction = extractWebsiteEvidence({
        url: validation.url,
        html,
        retrievedAt: nowISO,
      });
      const report = createWebsiteResearchReport(extraction);
      return deepFreeze({
        ok: true,
        report,
        evidence: createBuilderEvidence({
          evidenceId: `ev_web_${Date.parse(nowISO)}`,
          kind: "website_research",
          label: "Website research",
          source: "public_fetch",
          confidence: report.confidence,
          payload: report,
          retrievedAt: nowISO,
        }),
      });
    } catch {
      return deepFreeze({
        ok: false,
        reason: "fetch_failed",
        fallbackAvailable: true,
        message: "We could not reach that website. Paste key details and continue.",
      });
    }
  }
}

export { createWebsiteResearchReport };
