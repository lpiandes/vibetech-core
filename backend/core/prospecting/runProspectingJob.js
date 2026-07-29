/**
 * End-to-end prospecting run:
 * discover companies → public phone hunt (free) → brief → keep only phone+name+brief.
 * Email only when found free in public snippets. No paid enrichment. No invented phones.
 */
import crypto from "node:crypto";

import { readCrmState } from "../crm/CrmStore.js";
import { readSocialScreeningKeys } from "../integrations/social-screening/socialScreeningKeys.js";
import { OpenAIProvider } from "../providers/OpenAIProvider.js";
import { generateCompanyBrief } from "./companyBriefs.js";
import { findDuplicateContact } from "./dedupeCandidates.js";
import { discoverPublicContactDetails } from "./discoverPublicContactDetails.js";
import {
  getProspectingRun,
  normalizeCandidate,
  readProspectingState,
  upsertProspectingRun,
  writeProspectingState,
} from "./ProspectingJobStore.js";
import { qualifiesProspectLead } from "./publicContactExtract.js";
import { discoverCompaniesViaSerper } from "./serperCompanyDiscovery.js";

function emptyField() {
  return { value: null, rank: null, reason: null, source: null };
}

/**
 * Resolve Serper key: connection secrets → env platform key.
 */
export function resolveProspectingSerperKey({ env = process.env, secrets = null } = {}) {
  const fromSecrets = secrets && typeof secrets === "object" ? secrets : {};
  const direct = String(
    fromSecrets.serperApiKey ?? fromSecrets.SERPER_API_KEY ?? "",
  ).trim();
  if (direct) return direct;
  return readSocialScreeningKeys({ env, secrets }).serperApiKey;
}

/**
 * Execute a queued/running prospecting job and persist candidates.
 */
export async function runProspectingJob({
  platformStore,
  installation,
  runId,
  actorId = null,
  secrets = null,
  enrichmentSecrets = null,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  llmProvider = null,
  env = process.env,
} = {}) {
  if (!platformStore || !installation || !runId) {
    throw new Error("runProspectingJob requires platformStore, installation, runId");
  }
  // enrichmentSecrets intentionally unused — free public path only
  void enrichmentSecrets;

  let state = readProspectingState(installation);
  let run = getProspectingRun(state, runId);
  if (!run) throw new Error("Prospecting run not found");

  run = {
    ...run,
    status: "running",
    updatedAt: new Date().toISOString(),
    error: null,
  };
  state = upsertProspectingRun(state, run);
  await writeProspectingState({ platformStore, installation, prospectingState: state, actorId });
  installation = {
    ...installation,
    configuration: { ...installation.configuration, prospecting: state },
  };

  const serperApiKey = resolveProspectingSerperKey({ env, secrets });
  if (!serperApiKey) {
    run = {
      ...run,
      status: "failed",
      error: "Serper API key missing. Set SERPER_API_KEY or connect Social screening / prospecting keys.",
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    state = upsertProspectingRun(state, run);
    await writeProspectingState({ platformStore, installation, prospectingState: state, actorId });
    return { ok: false, run, error: run.error };
  }

  const provider = llmProvider
    ?? new OpenAIProvider({ mode: env.OPENAI_API_KEY ? "live" : "demo" });
  const crm = readCrmState(installation);
  const maxLeads = Math.max(1, Number(run.criteria?.maxLeads) || 10);
  const costMeta = {
    serperQueries: 0,
    enrichmentCalls: 0,
    enrichmentProvider: null,
    skippedNoPhone: 0,
    overfetched: 0,
  };

  try {
    // Overfetch companies — many will lack a public phone and be dropped
    const overfetch = Math.min(20, Math.max(maxLeads * 3, maxLeads));
    const companies = await discoverCompaniesViaSerper({
      criteria: { ...run.criteria, maxLeads: overfetch },
      apiKey: serperApiKey,
      fetchImpl,
      num: overfetch,
    });
    costMeta.serperQueries = 1;
    costMeta.overfetched = companies.length;

    const candidates = [];
    for (const company of companies) {
      if (candidates.length >= maxLeads) break;

      const contact = await discoverPublicContactDetails({
        company,
        criteria: run.criteria,
        apiKey: serperApiKey,
        fetchImpl,
      });
      costMeta.serperQueries += contact.serperQueries ?? 0;

      if (!contact.phone?.value && !(contact.phones?.length)) {
        costMeta.skippedNoPhone += 1;
        continue;
      }

      const brief = await generateCompanyBrief({
        company: {
          ...company,
          snippet: [company.snippet, ...(contact.texts ?? [])].filter(Boolean).join("\n").slice(0, 1200),
        },
        criteria: run.criteria,
        llmProvider: provider,
      });

      const name = String(brief.decisionMakerName || company.companyName || "").trim();
      const overview = String(brief.overview || company.snippet || "").trim();
      if (!qualifiesProspectLead({
        phone: contact.phone,
        phones: contact.phones,
        name,
        overview,
      })) {
        costMeta.skippedNoPhone += 1;
        continue;
      }

      const base = {
        id: `cand_${crypto.randomUUID().slice(0, 10)}`,
        status: "pending",
        companyName: company.companyName,
        website: company.website,
        overview,
        industry: brief.industry,
        sizeEstimate: brief.sizeEstimate,
        sizeEstimated: brief.sizeEstimated,
        decisionMakerName: name,
        decisionMakerTitle: brief.decisionMakerTitle,
        phones: contact.phones ?? [],
        emails: contact.emails ?? [],
        phone: contact.phone ?? emptyField(),
        email: contact.email ?? emptyField(),
        sources: [...new Set([
          ...(company.sources ?? []),
          ...(brief.sources ?? []),
          ...(contact.sources ?? []),
        ])],
        enrichmentProvider: null,
        costMeta: { provider: "public_serper", units: contact.serperQueries ?? 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const dup = findDuplicateContact(crm, base);
      if (dup.isDuplicate) {
        base.status = "duplicate";
        base.duplicateOfContactId = dup.contactId;
      }

      candidates.push(normalizeCandidate(base));
    }

    run = {
      ...run,
      status: "completed",
      candidates,
      costMeta,
      error: null,
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    state = upsertProspectingRun(state, run);
    await writeProspectingState({ platformStore, installation, prospectingState: state, actorId });
    return { ok: true, run };
  } catch (err) {
    run = {
      ...run,
      status: "failed",
      error: String(err?.message ?? err),
      costMeta,
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    state = upsertProspectingRun(state, run);
    await writeProspectingState({ platformStore, installation, prospectingState: state, actorId });
    return { ok: false, run, error: run.error };
  }
}
