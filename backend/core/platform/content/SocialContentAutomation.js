/**
 * Social Media Content Automation — draft social posts, approve, and publish.
 * Durable state on installation.configuration.socialContentDrafts.
 *
 * Publish path is honest: when a Meta/Facebook page token is connected we
 * attempt a real Graph API publish; otherwise the draft is approved and
 * queued for manual publish with a stated reason. We never fabricate a
 * "published" status without a provider reference.
 */
import crypto from "node:crypto";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { getSharedCredentialVault } from "../../integrations/credentials/CredentialVault.js";
import { hydrateWorkspaceCredentials } from "../../integrations/credentials/durableCredentialVault.js";

export const SOCIAL_CONTENT_CHANNELS = Object.freeze([
  "facebook",
  "instagram",
  "linkedin",
  "twitter",
  "generic",
]);

export const SOCIAL_CONTENT_STATUSES = Object.freeze([
  "draft",
  "approved",
  "published",
  "queued_for_manual_publish",
  "publish_failed",
]);

function nowISO() {
  return new Date().toISOString();
}

function normalizeChannel(channel) {
  const id = String(channel ?? "").trim().toLowerCase();
  return SOCIAL_CONTENT_CHANNELS.includes(id) ? id : "generic";
}

export function emptySocialContentState() {
  return { version: 1, drafts: [], updatedAt: null };
}

export function readSocialContentState(installation = null) {
  const raw = installation?.configuration?.socialContentDrafts;
  if (!raw || typeof raw !== "object") return emptySocialContentState();
  return {
    version: 1,
    drafts: Array.isArray(raw.drafts) ? raw.drafts : [],
    updatedAt: raw.updatedAt ?? null,
  };
}

export async function writeSocialContentState({ platformStore, installation, socialContentState, actorId = null }) {
  if (!platformStore || !installation) {
    throw new Error("writeSocialContentState requires platformStore and installation");
  }
  const next = {
    version: 1,
    drafts: socialContentState.drafts ?? [],
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
      ?? "social_content_update",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: Array.isArray(installation.actionCheckpoints) ? installation.actionCheckpoints : [],
    configuration: {
      ...(installation.configuration ?? {}),
      socialContentDrafts: next,
    },
    history: [
      ...(Array.isArray(installation.history) ? installation.history.slice(-49) : []),
      { at: next.updatedAt, action: "social_content_update", actorId },
    ],
    actorUserId: installation.actorUserId ?? actorId,
    installedAt: installation.installedAt ?? null,
  });
  return next;
}

function buildDraft({ channel, brief, body, actorId = null }) {
  const bodyText = String(body ?? "").trim();
  if (!bodyText) {
    throw new Error("SocialContentAutomation: body is required to create a draft post.");
  }
  const at = nowISO();
  const id = `social_draft_${crypto.randomUUID().slice(0, 10)}`;
  return {
    id,
    channel: normalizeChannel(channel),
    brief: String(brief ?? "").trim(),
    body: bodyText,
    status: "draft",
    createdAt: at,
    updatedAt: at,
    createdBy: actorId ? String(actorId) : null,
    approvedAt: null,
    approvedBy: null,
    publishedAt: null,
    publishProvider: null,
    externalReference: null,
    honestyReason: null,
    history: [{ at, action: "draft_created", actorId: actorId ?? null }],
  };
}

/**
 * Create a draft post and persist it. Never auto-publishes — a draft always
 * requires an explicit approve step (platform law: no unapproved outbound).
 * @returns {Promise<{ ok: true, draft: object, drafts: object[] }>}
 */
export async function createDraftPost({
  platformStore,
  installation,
  channel,
  brief,
  body,
  actorId = null,
}) {
  if (!platformStore || !installation) {
    throw new Error("createDraftPost requires platformStore and installation");
  }
  const draft = buildDraft({ channel, brief, body, actorId });
  const state = readSocialContentState(installation);
  const nextState = { ...state, drafts: [...state.drafts, draft] };
  const persisted = await writeSocialContentState({
    platformStore,
    installation,
    socialContentState: nextState,
    actorId,
  });
  return { ok: true, draft: deepFreeze(draft), drafts: deepFreeze(persisted.drafts) };
}

/**
 * @param {object|null} installation
 * @returns {object[]}
 */
export function listDrafts(installation) {
  return deepFreeze(readSocialContentState(installation).drafts);
}

/**
 * Locate a Meta/Facebook page credential in the credential vault for this workspace.
 * @returns {Promise<{ pageAccessToken: string, pageId: string } | null>}
 */
async function resolveMetaPageCredential({ platformStore, businessId, vault = null }) {
  if (!platformStore?.listIntegrationCredentialsForWorkspace) return null;
  const credentialVault = vault ?? getSharedCredentialVault();
  try {
    await hydrateWorkspaceCredentials({ platformStore, vault: credentialVault, workspaceId: businessId });
  } catch {
    /* best-effort hydrate */
  }
  const credentials = await platformStore.listIntegrationCredentialsForWorkspace(businessId).catch(() => []);
  const matching = (credentials ?? []).find((c) => /meta|facebook/i.test(String(c.providerType ?? c.credentialId ?? "")));
  if (!matching) return null;
  const record = typeof credentialVault?.get === "function" ? credentialVault.get(matching.credentialId) : null;
  const secrets = record?.secrets ?? {};
  const metadata = record?.metadata ?? matching.metadata ?? {};
  const pageAccessToken = String(secrets.pageAccessToken ?? secrets.accessToken ?? "").trim();
  const pageId = String(secrets.pageId ?? metadata.pageId ?? "").trim();
  if (!pageAccessToken || !pageId) return null;
  return { pageAccessToken, pageId };
}

/**
 * Attempt a live Graph API publish. Honest failure — never fabricates a post id.
 */
async function attemptGraphPublish({ platformStore, businessId, draft, vault = null, fetchImpl = globalThis.fetch }) {
  const credential = await resolveMetaPageCredential({ platformStore, businessId, vault });
  if (!credential) {
    return {
      attempted: false,
      reason: "not_connected",
      message: "No connected Meta/Facebook page token — draft approved and queued for manual publish.",
    };
  }
  try {
    const res = await fetchImpl(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(credential.pageId)}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          message: draft.body,
          access_token: credential.pageAccessToken,
        }).toString(),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.id) {
      return {
        attempted: true,
        ok: false,
        reason: String(data?.error?.message ?? `meta_http_${res.status}`),
        message: `Meta Graph publish failed: ${String(data?.error?.message ?? res.status)}`,
      };
    }
    return {
      attempted: true,
      ok: true,
      externalReference: String(data.id),
      provider: "meta_graph",
    };
  } catch (err) {
    return {
      attempted: true,
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
      message: `Meta Graph publish threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Approve a draft, then attempt live publish. Honest outcomes:
 * - published: real Graph API post id returned.
 * - queued_for_manual_publish: no connected token — still a complete approve step.
 * - publish_failed: token connected but Graph rejected the post.
 * @returns {Promise<{ ok: true, draft: object, drafts: object[] }|{ ok: false, reason: string, message: string }>}
 */
export async function approveAndQueuePublish({
  platformStore,
  installation,
  businessId = installation?.businessId,
  draftId,
  actorId = null,
  vault = null,
  fetchImpl = globalThis.fetch,
}) {
  if (!platformStore || !installation) {
    throw new Error("approveAndQueuePublish requires platformStore and installation");
  }
  const state = readSocialContentState(installation);
  const idx = state.drafts.findIndex((d) => String(d.id) === String(draftId));
  if (idx < 0) {
    return { ok: false, reason: "draft_not_found", message: "No draft with that id." };
  }
  const existing = state.drafts[idx];
  const at = nowISO();
  const approved = {
    ...existing,
    status: "approved",
    approvedAt: at,
    approvedBy: actorId ?? null,
    updatedAt: at,
    history: [...existing.history, { at, action: "approved", actorId: actorId ?? null }],
  };

  const publishResult = await attemptGraphPublish({ platformStore, businessId, draft: approved, vault, fetchImpl });

  let finalDraft;
  const publishAt = nowISO();
  if (publishResult.attempted && publishResult.ok) {
    finalDraft = {
      ...approved,
      status: "published",
      publishedAt: publishAt,
      publishProvider: publishResult.provider,
      externalReference: publishResult.externalReference,
      updatedAt: publishAt,
      history: [...approved.history, { at: publishAt, action: "published", actorId: actorId ?? null, externalReference: publishResult.externalReference }],
    };
  } else if (publishResult.attempted && !publishResult.ok) {
    finalDraft = {
      ...approved,
      status: "publish_failed",
      honestyReason: publishResult.message,
      updatedAt: publishAt,
      history: [...approved.history, { at: publishAt, action: "publish_failed", actorId: actorId ?? null, reason: publishResult.reason }],
    };
  } else {
    finalDraft = {
      ...approved,
      status: "queued_for_manual_publish",
      honestyReason: publishResult.message,
      updatedAt: publishAt,
      history: [...approved.history, { at: publishAt, action: "queued_for_manual_publish", actorId: actorId ?? null, reason: publishResult.reason }],
    };
  }

  const drafts = [...state.drafts];
  drafts[idx] = finalDraft;
  const persisted = await writeSocialContentState({
    platformStore,
    installation,
    socialContentState: { ...state, drafts },
    actorId,
  });
  return { ok: true, draft: deepFreeze(finalDraft), drafts: deepFreeze(persisted.drafts) };
}

/**
 * Prove helper — creates a draft and immediately approves + attempts publish.
 * Honest end-to-end proof of the draft → approve product path (not a fake success):
 * result.draft.status is "published" only with a real provider reference,
 * otherwise "queued_for_manual_publish" or "publish_failed" with a stated reason.
 */
export async function runSocialContentDraftProve({
  platformStore,
  installation,
  businessId = installation?.businessId,
  channel = "facebook",
  actorId = "social_content_prove",
  vault = null,
  fetchImpl = globalThis.fetch,
}) {
  if (!platformStore || !installation) {
    throw new Error("runSocialContentDraftProve requires platformStore and installation");
  }
  const created = await createDraftPost({
    platformStore,
    installation,
    channel,
    brief: "VIBETech prove — sample social content draft",
    body: "We're rolling out something new — stay tuned! (VIBETech prove test, safe to ignore.)",
    actorId,
  });
  // Re-read installation so approve step sees the freshly persisted draft.
  const fresh = await platformStore.getBusinessOSInstallation?.(businessId).catch(() => installation) ?? installation;
  const approved = await approveAndQueuePublish({
    platformStore,
    installation: fresh,
    businessId,
    draftId: created.draft.id,
    actorId,
    vault,
    fetchImpl,
  });
  return deepFreeze({
    ok: true,
    draft: approved.draft,
    message: approved.draft.status === "published"
      ? "Draft created, approved, and published to the connected Meta page."
      : approved.draft.status === "publish_failed"
        ? `Draft created and approved; live publish failed: ${approved.draft.honestyReason}`
        : "Draft created and approved; queued for manual publish (no connected Meta/Facebook page token).",
  });
}
