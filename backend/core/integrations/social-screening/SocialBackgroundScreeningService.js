/**
 * Orchestrate social background screening: discover → fetch → FCRA-filtered report.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { readSocialScreeningKeys } from "./socialScreeningKeys.js";
import { discoverSocialProfiles } from "./serperSocialDiscovery.js";
import { fetchManyPublicPages } from "./scrapingBeeFetch.js";
import {
  analyzeSocialScreenReport,
  formatSocialScreenReportBody,
} from "./analyzeSocialScreenReport.js";

/**
 * @param {object} params
 * @param {object} params.subject - { name, email, handles?, location? }
 * @param {object} [params.keys]
 * @param {object} [params.llmProvider]
 * @param {typeof fetch} [params.fetchImpl]
 */
export async function runSocialBackgroundScreen({
  subject = {},
  keys = null,
  env = process.env,
  llmProvider = null,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  networks = null,
} = {}) {
  const resolved = keys && typeof keys === "object"
    ? {
      serperApiKey: String(keys.serperApiKey ?? "").trim(),
      scrapingBeeApiKey: String(keys.scrapingBeeApiKey ?? "").trim(),
      ready: Boolean(keys.serperApiKey && keys.scrapingBeeApiKey),
    }
    : readSocialScreeningKeys({ env });

  if (!resolved.ready) {
    return deepFreeze({
      ok: false,
      reason: "social_screening_keys_missing",
      report: null,
      reportBody: "",
    });
  }

  const discovery = await discoverSocialProfiles({
    subject,
    serperApiKey: resolved.serperApiKey,
    networks,
    fetchImpl,
  });
  if (!discovery.ok && discovery.reason === "subject_name_required") {
    return deepFreeze({
      ok: false,
      reason: discovery.reason,
      report: null,
      reportBody: "",
    });
  }

  const urls = (discovery.profiles ?? []).map((p) => p.url).filter(Boolean);
  const pages = await fetchManyPublicPages({
    urls,
    scrapingBeeApiKey: resolved.scrapingBeeApiKey,
    fetchImpl,
    maxPages: 6,
  });

  const report = await analyzeSocialScreenReport({
    subject,
    profiles: discovery.profiles ?? [],
    pages,
    llmProvider,
  });
  const reportBody = formatSocialScreenReportBody(report);

  return deepFreeze({
    ok: true,
    reason: null,
    discovery,
    pages: pages.map((p) => ({ url: p.url, ok: p.ok, reason: p.reason ?? null })),
    report,
    reportBody,
  });
}
