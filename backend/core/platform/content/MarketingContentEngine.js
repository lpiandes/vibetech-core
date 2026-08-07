/**
 * Marketing Content Engine — brief → draft assets (email + sms + social) via
 * deterministic templates (no LLM required). Durable state on
 * installation.configuration.marketingContentJobs.
 *
 * Approving a job hands email/sms drafts to the same owner-approval queue
 * (installation.configuration.pendingDecisionDrafts) that gates every other
 * outbound send on the platform — no parallel approval system.
 */
import crypto from "node:crypto";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export const MARKETING_CONTENT_CHANNELS = Object.freeze(["email", "sms", "social"]);

function nowISO() {
  return new Date().toISOString();
}

export function emptyMarketingContentState() {
  return { version: 1, jobs: [], updatedAt: null };
}

export function readMarketingContentState(installation = null) {
  const raw = installation?.configuration?.marketingContentJobs;
  if (!raw || typeof raw !== "object") return emptyMarketingContentState();
  return {
    version: 1,
    jobs: Array.isArray(raw.jobs) ? raw.jobs : [],
    updatedAt: raw.updatedAt ?? null,
  };
}

export async function writeMarketingContentState({ platformStore, installation, marketingContentState, actorId = null }) {
  if (!platformStore || !installation) {
    throw new Error("writeMarketingContentState requires platformStore and installation");
  }
  const next = {
    version: 1,
    jobs: marketingContentState.jobs ?? [],
    updatedAt: nowISO(),
  };
  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId ?? `spec_${installation.businessId}`,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "marketing_content_update",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: Array.isArray(installation.actionCheckpoints) ? installation.actionCheckpoints : [],
    configuration: {
      ...(installation.configuration ?? {}),
      marketingContentJobs: next,
    },
    history: [
      ...(Array.isArray(installation.history) ? installation.history.slice(-49) : []),
      { at: next.updatedAt, action: "marketing_content_update", actorId },
    ],
    actorUserId: installation.actorUserId ?? actorId,
    installedAt: installation.installedAt ?? null,
  });
  return next;
}

function firstSentence(text, fallback) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return fallback;
  const match = trimmed.match(/^[^.!?]*[.!?]?/);
  return (match?.[0] || trimmed).trim() || fallback;
}

function slugKeyword(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

/**
 * Deterministic template rendering — no LLM call. Honest: content is a
 * straightforward assembly of the supplied brief fields, not an invented claim.
 */
export function renderDraftsFromBrief(brief = {}) {
  const businessName = String(brief.businessName ?? "our team").trim() || "our team";
  const headline = String(brief.headline ?? brief.offer ?? "An update from us").trim() || "An update from us";
  const audience = String(brief.audience ?? "valued customers").trim() || "valued customers";
  const offer = String(brief.offer ?? brief.headline ?? "").trim();
  const cta = String(brief.cta ?? "Reply to this message to learn more.").trim() || "Reply to this message to learn more.";
  const summary = firstSentence(brief.details ?? offer ?? headline, headline);

  const email = deepFreeze({
    subject: `${headline} — ${businessName}`,
    body: [
      `Hi there,`,
      "",
      offer ? `${offer}` : `${summary}`,
      brief.details ? String(brief.details).trim() : "",
      "",
      cta,
      "",
      `— ${businessName}`,
    ].filter((line, idx, arr) => !(line === "" && arr[idx - 1] === "")).join("\n"),
  });

  const sms = deepFreeze({
    body: `${businessName}: ${summary} ${cta} Reply STOP to opt out.`.slice(0, 320),
  });

  const hashtag = slugKeyword(headline || offer || businessName);
  const social = deepFreeze({
    body: [
      `${summary}`,
      offer && offer !== summary ? offer : "",
      cta,
      hashtag ? `#${hashtag}` : "",
    ].filter(Boolean).join(" "),
  });

  return deepFreeze({ email, sms, social });
}

function buildJob({ brief, actorId = null }) {
  const at = nowISO();
  const id = `marketing_job_${crypto.randomUUID().slice(0, 10)}`;
  const drafts = renderDraftsFromBrief(brief);
  return {
    id,
    brief: {
      businessName: String(brief?.businessName ?? "").trim(),
      headline: String(brief?.headline ?? "").trim(),
      audience: String(brief?.audience ?? "").trim(),
      offer: String(brief?.offer ?? "").trim(),
      details: String(brief?.details ?? "").trim(),
      cta: String(brief?.cta ?? "").trim(),
    },
    status: "draft",
    channelStatus: { email: "draft", sms: "draft", social: "draft" },
    drafts,
    createdAt: at,
    updatedAt: at,
    createdBy: actorId ? String(actorId) : null,
    approvedAt: null,
    approvedBy: null,
    pendingDecisionDraftIds: [],
  };
}

/**
 * Brief → generated drafts for email + sms + social. Persists the job.
 * @returns {Promise<{ ok: true, job: object, jobs: object[] }>}
 */
export async function fromBrief({ platformStore, installation, brief, actorId = null }) {
  if (!platformStore || !installation) {
    throw new Error("fromBrief requires platformStore and installation");
  }
  if (!brief || (!brief.headline && !brief.offer)) {
    throw new Error("MarketingContentEngine: brief.headline or brief.offer is required.");
  }
  const job = buildJob({ brief, actorId });
  const state = readMarketingContentState(installation);
  const nextState = { ...state, jobs: [...state.jobs, job] };
  const persisted = await writeMarketingContentState({
    platformStore,
    installation,
    marketingContentState: nextState,
    actorId,
  });
  return { ok: true, job: deepFreeze(job), jobs: deepFreeze(persisted.jobs) };
}

export function listJobs(installation) {
  return deepFreeze(readMarketingContentState(installation).jobs);
}

/**
 * Approve selected channels on a job. Email/SMS drafts join the shared
 * owner-approval queue (pendingDecisionDrafts) — customer sends stay
 * approval-gated everywhere on the platform. Social status flips locally to
 * pending_approval (the social draft/approve path itself lives in
 * SocialContentAutomation for live publish).
 * @returns {Promise<{ ok: true, job: object, jobs: object[] }|{ ok: false, reason: string, message: string }>}
 */
export async function approveMarketingContentJob({
  platformStore,
  installation,
  jobId,
  channels = MARKETING_CONTENT_CHANNELS,
  actorId = null,
}) {
  if (!platformStore || !installation) {
    throw new Error("approveMarketingContentJob requires platformStore and installation");
  }
  const state = readMarketingContentState(installation);
  const idx = state.jobs.findIndex((j) => String(j.id) === String(jobId));
  if (idx < 0) {
    return { ok: false, reason: "job_not_found", message: "No marketing content job with that id." };
  }
  const requestedChannels = new Set(
    (Array.isArray(channels) ? channels : MARKETING_CONTENT_CHANNELS)
      .map(String)
      .filter((c) => MARKETING_CONTENT_CHANNELS.includes(c)),
  );
  const existing = state.jobs[idx];
  const at = nowISO();

  const pendingDrafts = Array.isArray(installation?.configuration?.pendingDecisionDrafts)
    ? [...installation.configuration.pendingDecisionDrafts]
    : [];
  const newDraftIds = [];

  const channelStatus = { ...existing.channelStatus };
  for (const channel of requestedChannels) {
    if (channel === "email") {
      const draftId = `draft_marketing_email_${existing.id}`;
      pendingDrafts.push({
        id: draftId,
        channel: "email",
        status: "pending_approval",
        subject: existing.drafts.email.subject,
        bodyPreview: existing.drafts.email.body,
        audience: existing.brief.audience || "marketing_content_engine",
        createdAt: at,
        source: "marketing_content_engine",
        jobId: existing.id,
      });
      newDraftIds.push(draftId);
      channelStatus.email = "pending_approval";
    } else if (channel === "sms") {
      const draftId = `draft_marketing_sms_${existing.id}`;
      pendingDrafts.push({
        id: draftId,
        channel: "sms",
        status: "pending_approval",
        bodyPreview: existing.drafts.sms.body,
        audience: existing.brief.audience || "marketing_content_engine",
        createdAt: at,
        source: "marketing_content_engine",
        jobId: existing.id,
      });
      newDraftIds.push(draftId);
      channelStatus.sms = "pending_approval";
    } else if (channel === "social") {
      channelStatus.social = "pending_approval";
    }
  }

  const allApproved = MARKETING_CONTENT_CHANNELS.every((c) => channelStatus[c] === "pending_approval" || channelStatus[c] === "approved");
  const job = {
    ...existing,
    status: allApproved ? "pending_approval" : "partially_approved",
    channelStatus,
    approvedAt: at,
    approvedBy: actorId ?? null,
    updatedAt: at,
    pendingDecisionDraftIds: [...existing.pendingDecisionDraftIds, ...newDraftIds],
  };

  const jobs = [...state.jobs];
  jobs[idx] = job;
  const persisted = await writeMarketingContentState({
    platformStore,
    installation,
    marketingContentState: { ...state, jobs },
    actorId,
  });

  if (newDraftIds.length) {
    const fresh = await platformStore.getBusinessOSInstallation?.(installation.businessId).catch(() => installation) ?? installation;
    await platformStore.upsertBusinessOSInstallation({
      id: fresh.id ?? fresh.installationId ?? `install_${installation.businessId}`,
      businessId: installation.businessId,
      specificationRowId: fresh.specificationRowId ?? null,
      specificationId: fresh.specificationId ?? `spec_${installation.businessId}`,
      specificationVersion: fresh.specificationVersion ?? 1,
      specificationContentHash: fresh.specificationContentHash ?? fresh.contentHash ?? "marketing_content_approve",
      planId: fresh.planId ?? `plan_${installation.businessId}`,
      status: fresh.status ?? "installed",
      plan: fresh.plan ?? {},
      actionCheckpoints: Array.isArray(fresh.actionCheckpoints) ? fresh.actionCheckpoints : [],
      configuration: {
        ...(fresh.configuration ?? {}),
        pendingDecisionDrafts: pendingDrafts.slice(-25),
      },
      history: Array.isArray(fresh.history) ? fresh.history.slice(-50) : [],
      installedAt: fresh.installedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: actorId ?? "marketing_content_engine",
    });
  }

  return { ok: true, job: deepFreeze(job), jobs: deepFreeze(persisted.jobs) };
}
