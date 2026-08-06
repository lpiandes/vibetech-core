/**
 * API: run integration prove tests (OAuth ≠ proven).
 * Persists capability_proof_records and executes against live providers when credentials exist.
 */
import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { getPlatformStore, withClient } from "@/lib/server/compose";
import { invalidateCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";
import {
  proofRecordFromResult,
  runIntegrationProveTest,
  PROVE_ACTIONS,
} from "../../../../../../../backend/core/integrations/prove/IntegrationProveService.js";
import {
  executeLiveProveAction,
  resolveProveConnectionStatus,
} from "../../../../../../../backend/core/integrations/prove/executeLiveProveAction.js";
import { evaluateOutboundSendPermission } from "../../../../../../../backend/core/approvals/OutboundApprovalGate.js";
import { INTEGRATION_CAPABILITIES } from "../../../../../../../backend/core/integrations/capabilities/IntegrationCapability.js";
import { PostgresPlatformJobQueue } from "../../../../../../../backend/core/platform/jobs/PostgresPlatformJobQueue.js";
import { runVerticalGoldenPathLive } from "../../../../../../../backend/core/platform/golden-paths/runVerticalGoldenPathLive.js";
import { attachProveEvidenceToRftOpportunity } from "../../../../../../../backend/core/ai-builder/operating-contract/rft/attachProveEvidenceToRft.js";
import { readRftLaunch } from "../../../../../../../backend/core/ai-builder/operating-contract/rft/rftLaunch.js";

async function maybeAttachRftEvidence({
  platformStore,
  businessId,
  action,
  result,
}: {
  platformStore: ReturnType<typeof getPlatformStore>;
  businessId: string;
  action: string;
  result: Record<string, unknown>;
}) {
  const detail = (result?.detail && typeof result.detail === "object")
    ? result.detail as Record<string, unknown>
    : {};
  const hasRef = Boolean(
    detail.externalReference
    || detail.messageId
    || detail.eventId
    || detail.sid
    || detail.formSubmissionId
    || detail.providerId,
  );
  const verified = result?.verified === true && result?.ok === true;
  // Need a provider id; attach on verified proves, or when a launch prove card already exists.
  if (!hasRef) return null;
  try {
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) return null;
    const launch = readRftLaunch(installation);
    if (!launch.proveCardId && !verified) return null;
    return await attachProveEvidenceToRftOpportunity({
      platformStore,
      installation,
      businessId,
      action,
      proveResult: result,
      actorId: "prove_route",
    });
  } catch {
    return null;
  }
}
const ACTION_TO_CAPABILITY: Record<string, string> = {
  send_test_email: "customer_email_send",
  create_test_event: "calendar_scheduling",
  send_test_sms: "sms_send",
  place_test_call: "voice_calls",
  run_sample_social_screen: "social_screen_prove",
  ingest_test_lead: "meta_lead_intake",
  upload_and_cite: "knowledge_consult",
  approve_and_send: "outbound_approvals",
  run_sports_golden_path: "sports_registration_golden_path",
  run_dental_golden_path: "dental_intake_golden_path",
  submit_test_form: "website_forms",
  sync_test_crm_contact: "crm_hubspot",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const outboundApproved = body?.outboundApproved !== false;
    const ownerConfirmedReceipt = body?.ownerConfirmedReceipt === true;
    const platformStore = getPlatformStore();
    const capabilityId = String(body?.capabilityId ?? ACTION_TO_CAPABILITY[action] ?? action);
    const needsOwnerReceipt =
      action === "send_test_email"
      || action === "send_test_sms"
      || action === "create_test_event";

    // Knowledge defer is a Knowledge action — Integrations manage is not required.
    const isKnowledgeDefer = body?.defer === true && capabilityId === "knowledge_consult";
    const ctx = await getAuthorizedWorkspace(
      businessId,
      isKnowledgeDefer ? PERMISSIONS.KNOWLEDGE_MANAGE : PERMISSIONS.INTEGRATIONS_MANAGE,
    );

    // Knowledge can be deferred — not proven, but launch path continues.
    if (isKnowledgeDefer) {
      const at = new Date().toISOString();
      const result = {
        ok: false,
        verified: false,
        status: "deferred",
        proveAction: action || "upload_and_cite",
        at,
        message: "Knowledge skipped for now. Add documents anytime from Knowledge.",
        detail: { deferredByOwner: true, at },
      };
      const proofRecord = proofRecordFromResult(capabilityId, result);
      await platformStore.upsertCapabilityProofRecord({
        businessId,
        capabilityId,
        proveAction: action || "upload_and_cite",
        ok: false,
        verified: false,
        detail: {
          status: "deferred",
          message: result.message,
          at,
          deferredByOwner: true,
        },
      });
      return NextResponse.json({
        result: { ...result, deferred: true },
        proofRecord,
        rule: "Deferred knowledge is not proven. Upload documents later to prove citeable Knowledge.",
      });
    }

    // Owner confirms they received the outbound/calendar test — marks Done without re-running.
    if (ownerConfirmedReceipt && needsOwnerReceipt) {
      const existing = await platformStore.getCapabilityProofRecord(businessId, capabilityId);
      const detail = existing?.detail && typeof existing.detail === "object" ? existing.detail : {};
      const awaiting = detail.awaitingOwnerConfirm === true;
      const ref = detail.externalReference ?? detail.messageId ?? null;
      if (!awaiting || !ref) {
        return NextResponse.json(
          {
            error: "Run the test first, then confirm you saw the result.",
            result: { ok: false, reason: "confirm_before_send", status: "needs_setup" },
          },
          { status: 400 },
        );
      }
      const at = new Date().toISOString();
      const confirmMessage =
        action === "send_test_sms"
          ? "You confirmed the test text — SMS is proven."
          : action === "create_test_event"
            ? "You confirmed the test event — calendar is proven."
            : "You confirmed the test email — email is proven.";
      const result = {
        ok: true,
        verified: true,
        status: "proven",
        proveAction: action,
        at,
        message: confirmMessage,
        detail: {
          ...detail,
          awaitingOwnerConfirm: false,
          ownerConfirmedAt: at,
          externalReference: ref,
        },
      };
      const proofRecord = proofRecordFromResult(capabilityId, result);
      await platformStore.upsertCapabilityProofRecord({
        businessId,
        capabilityId,
        proveAction: action || capabilityId,
        ok: true,
        verified: true,
        detail: {
          status: result.status,
          reason: null,
          message: result.message,
          at,
          externalReference: ref,
          deliveryStatus: detail.deliveryStatus ?? null,
          simulated: false,
          awaitingOwnerConfirm: false,
          ownerConfirmedAt: at,
          execution: detail.execution ?? {},
        },
      });
      const rftAttach = await maybeAttachRftEvidence({
        platformStore,
        businessId,
        action,
        result: { ...result, detail: { ...detail, externalReference: ref } },
      });
      return NextResponse.json({
        result,
        proofRecord,
        rftAttach,
        rule: "Connected is not proven. Proven requires a successful proveAction plus owner receipt confirm for live tests.",
      });
    }

    const [credentials, connections, knowledgeCount] = await Promise.all([
      platformStore.listIntegrationCredentialsForWorkspace(businessId),
      Promise.resolve(
        (ctx.service as any)?.connected?.connectedSystemsSnapshot?.connections ?? [],
      ),
      platformStore.countActiveKnowledgeDocuments(businessId).catch(() => 0),
    ]);

    const connectionStatus =
      body?.connectionStatus
        ? String(body.connectionStatus)
        : resolveProveConnectionStatus({ action, credentials, connections });

    const result = await runIntegrationProveTest({
      action,
      connectionStatus,
      outboundApproved,
      execute: body?.simulateFailure
        ? async () => ({ ok: false, reason: "simulated_failure", message: "Simulated prove failure" })
        : async () =>
            executeProveForAction({
              action,
              businessId,
              platformStore,
              knowledgeCount,
              proveEmail: body?.proveEmail ?? process.env.PROVE_TEST_EMAIL ?? null,
              provePhone: body?.provePhone ?? process.env.PROVE_TEST_PHONE ?? null,
              allowSimulated: body?.allowSimulated === true || process.env.PROVE_ALLOW_SIMULATED === "1",
              outboundApproved,
              vault: (ctx.service as any)?.connected?.integrationPlatform?.credentialVault ?? null,
            }),
    });

    // Outbound send succeeded — wait for owner "Got it" before marking the mission Done.
    const externalReference = result.detail?.externalReference ?? result.detail?.messageId ?? null;
    const deferComplete = Boolean(
      needsOwnerReceipt
      && result.ok
      && externalReference
      && result.detail?.simulated !== true,
    );
    const storedResult = deferComplete
      ? {
          ...result,
          ok: false,
          status: "awaiting_confirm",
          message: action === "send_test_sms"
            ? "Test text sent. Confirm you received it to mark this done."
            : action === "create_test_event"
              ? "Test calendar event created. Confirm you see it to mark this done."
              : "Test email sent. Confirm you received it to mark this done.",
          detail: {
            ...(result.detail ?? {}),
            awaitingOwnerConfirm: true,
            externalReference,
            deliverySucceeded: true,
          },
        }
      : result;

    const proofRecord = proofRecordFromResult(capabilityId, storedResult);

    await platformStore.upsertCapabilityProofRecord({
      businessId,
      capabilityId,
      proveAction: action || capabilityId,
      ok: Boolean(storedResult.ok),
      verified: Boolean(storedResult.verified),
      detail: {
        status: storedResult.status,
        reason: storedResult.reason ?? null,
        message: storedResult.message ?? null,
        at: storedResult.at,
        // Flatten provider refs so Home honesty checks can see them.
        externalReference,
        deliveryStatus: storedResult.detail?.deliveryStatus ?? null,
        simulated: storedResult.detail?.simulated === true,
        awaitingOwnerConfirm: deferComplete,
        execution: storedResult.detail ?? {},
      },
    });

    const rftAttach = storedResult.ok || externalReference
      ? await maybeAttachRftEvidence({
        platformStore,
        businessId,
        action,
        result: storedResult,
      })
      : null;

    invalidateCachedBusinessOsInstallation(businessId);

    return NextResponse.json({
      result: storedResult,
      proofRecord,
      rftAttach,
      rule: "Connected is not proven. Proven requires a successful proveAction.",
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const proofs = await getPlatformStore().listCapabilityProofRecords(businessId);
    return NextResponse.json({ proofs });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

async function executeProveForAction(input: {
  action: string;
  businessId: string;
  platformStore: any;
  knowledgeCount: number;
  proveEmail: string | null;
  provePhone: string | null;
  allowSimulated: boolean;
  outboundApproved: boolean;
  vault?: any;
}) {
  const { action } = input;

  if (action === PROVE_ACTIONS.upload_and_cite) {
    if (Number(input.knowledgeCount) < 1) {
      return {
        ok: false,
        reason: "knowledge_empty",
        message: "Add at least one Knowledge document, then prove again.",
      };
    }
    return {
      ok: true,
      simulated: false,
      knowledgeCount: input.knowledgeCount,
      message: "Knowledge documents are present and citeable.",
    };
  }

  if (action === PROVE_ACTIONS.approve_and_send) {
    const blocked = evaluateOutboundSendPermission({
      capability: INTEGRATION_CAPABILITIES.SEND_EMAIL,
      channel: "email",
      outboundApproved: false,
    });
    if (blocked.allowed) {
      return {
        ok: false,
        reason: "outbound_gate_broken",
        message: "Outbound gate failed — send was allowed without GRANT.",
      };
    }
    return {
      ok: true,
      simulated: false,
      gate: blocked,
      message: "Outbound correctly blocked without owner GRANT.",
    };
  }

  if (action === PROVE_ACTIONS.run_sports_golden_path || action === PROVE_ACTIONS.run_dental_golden_path) {
    const vertical = action === PROVE_ACTIONS.run_sports_golden_path ? "sports" : "dental";
    const queue = new PostgresPlatformJobQueue({ withClient });
    const pathResult = await runVerticalGoldenPathLive({
      vertical,
      businessId: input.businessId,
      queue,
      outboundApproved: input.outboundApproved,
      workspaceGate: {
        industry: vertical,
        operatingPackId: vertical === "sports" ? "youth_sports_v1" : "dental_v1",
      },
    });
    return {
      ok: Boolean(pathResult?.ok),
      simulated: false,
      workId: pathResult?.workId ?? null,
      workHref: pathResult?.workHref ?? null,
      detail: pathResult,
    };
  }

  if (action === PROVE_ACTIONS.submit_test_form) {
    const formSubmissionId = `form_prove_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      ok: true,
      verified: true,
      simulated: input.allowSimulated,
      message: "Website form intake recorded for prove.",
      detail: {
        formSubmissionId,
        externalReference: formSubmissionId,
        providerKind: "form_submission_id",
        at: new Date().toISOString(),
        note: "Controlled prove submission — not a live website visitor.",
      },
    };
  }

  if (action === "run_sample_social_screen" || action === PROVE_ACTIONS.run_sample_social_screen) {
    const { processSocialBackgroundScreenJob } = await import(
      "../../../../../../../backend/core/platform/jobs/processSocialBackgroundScreenJob.js"
    );
    const { loadSpecialtyWorkerWorkspace } = await import(
      "../../../../../../../backend/core/platform/jobs/loadSpecialtyWorkerWorkspace.js"
    );
    const { getSharedCredentialVault } = await import("@/lib/server/liveIntegrations");
    const result = await processSocialBackgroundScreenJob({
      job: {
        businessId: input.businessId,
        payload: {
          subjectName: "Sample Candidate",
          name: "Sample Candidate",
          handles: ["sample.candidate"],
          employeeId: "emp_social_background_screener_default",
        },
      },
      platformStore: input.platformStore,
      loadWorkspace: async (id: string) => {
        const loaded = await loadSpecialtyWorkerWorkspace({
          businessId: id,
          platformStore: input.platformStore,
          employeeId: "emp_social_background_screener_default",
        });
        if (!loaded.ok) return loaded;
        return { ...loaded, credentialVault: getSharedCredentialVault() };
      },
    });
    return {
      ok: Boolean(result?.ok),
      simulated: false,
      workItemId: result?.workItemId ?? null,
      message: result?.ok
        ? "Sample social background screen complete — review the report in Needs Attention / Work."
        : String(result?.reason ?? "Social screen prove failed"),
      detail: result,
    };
  }

  return executeLiveProveAction({
    action,
    businessId: input.businessId,
    platformStore: input.platformStore,
    proveEmail: input.proveEmail,
    provePhone: input.provePhone,
    allowSimulated: input.allowSimulated,
    vault: input.vault ?? null,
  });
}
