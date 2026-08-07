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
  place_test_outbound_call: "voice_calls",
  run_sample_social_screen: "social_screen_prove",
  ingest_test_lead: "meta_lead_intake",
  upload_and_cite: "knowledge_consult",
  approve_and_send: "outbound_approvals",
  run_sports_golden_path: "sports_registration_golden_path",
  run_dental_golden_path: "dental_intake_golden_path",
  submit_test_form: "website_forms",
  submit_test_chat: "website_chat",
  sync_test_crm_contact: "crm_hubspot",
  // Alternate, deeper CRM prove — pulls real contacts back into People, same capability.
  sync_pull_crm_contacts: "crm_hubspot",
  // Alternate, deeper calendar prove — maps to the same capability as create_test_event.
  book_test_slot: "calendar_scheduling",
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
      let responsibilityProof = null;
      try {
        const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
        if (installation) {
          const { persistResponsibilityProofResolution } = await import(
            "../../../../../../../backend/core/ai-builder/responsibility/persistResponsibilityProofResolution.js"
          );
          responsibilityProof = await persistResponsibilityProofResolution({
            platformStore,
            installation,
            capabilityId,
            proveAction: action || capabilityId,
            proofReference: `${capabilityId}:${ref}`,
            actorId: ctx.user?.id ?? null,
            nowISO: at,
          });
        }
      } catch {
        responsibilityProof = null;
      }
      invalidateCachedBusinessOsInstallation(businessId);
      return NextResponse.json({
        result,
        proofRecord,
        rftAttach,
        responsibilityProof,
        rule: "Connected is not proven. Proven requires a successful proveAction plus owner receipt confirm for live tests.",
      });
    }

    const [credentials, connections, knowledgeCount, knowledgeDocs] = await Promise.all([
      platformStore.listIntegrationCredentialsForWorkspace(businessId),
      Promise.resolve(
        (ctx.service as any)?.connected?.connectedSystemsSnapshot?.connections ?? [],
      ),
      platformStore.countActiveKnowledgeDocuments(businessId).catch(() => 0),
      platformStore.listKnowledgeDocumentsForBusiness(businessId).catch(() => []),
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
              knowledgeDocs: Array.isArray(knowledgeDocs) ? knowledgeDocs : [],
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

    let responsibilityProof = null;
    if (storedResult.ok && !deferComplete) {
      try {
        const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
        if (installation) {
          const { persistResponsibilityProofResolution } = await import(
            "../../../../../../../backend/core/ai-builder/responsibility/persistResponsibilityProofResolution.js"
          );
          responsibilityProof = await persistResponsibilityProofResolution({
            platformStore,
            installation,
            capabilityId,
            proveAction: action || capabilityId,
            proofReference: externalReference
              ? `${capabilityId}:${externalReference}`
              : String(capabilityId),
            actorId: ctx.user?.id ?? null,
          });
        }
      } catch {
        responsibilityProof = null;
      }
    }

    invalidateCachedBusinessOsInstallation(businessId);

    return NextResponse.json({
      result: storedResult,
      proofRecord,
      rftAttach,
      responsibilityProof,
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
  knowledgeDocs?: unknown[];
  knowledgeCited?: unknown[];
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
    const docs = Array.isArray(input.knowledgeDocs) ? input.knowledgeDocs : [];
    const cited = docs
      .slice(0, 3)
      .map((doc: any) => String(doc?.id ?? doc?.documentId ?? doc?.title ?? "").trim())
      .filter(Boolean);
    if (!cited.length && Number(input.knowledgeCount) >= 1) {
      // Docs exist in count but ids unavailable — still require explicit cite payload from caller.
      if (!Array.isArray(input.knowledgeCited) || input.knowledgeCited.length < 1) {
        return {
          ok: false,
          reason: "knowledge_cite_missing",
          message: "Knowledge is present but no citeable document ids were returned. Re-upload or refresh Knowledge, then prove again.",
        };
      }
    }
    const knowledgeCited = cited.length
      ? cited
      : (input.knowledgeCited ?? []).map((id: unknown) => String(id)).filter(Boolean);
    if (knowledgeCited.length < 1) {
      return {
        ok: false,
        reason: "knowledge_cite_missing",
        message: "Prove requires at least one cited Knowledge document id.",
      };
    }
    return {
      ok: true,
      simulated: false,
      knowledgeCount: input.knowledgeCount,
      knowledgeCited,
      message: `Knowledge cite prove passed (${knowledgeCited.length} document${knowledgeCited.length === 1 ? "" : "s"}).`,
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
    // Prove the gate opens correctly too — a gate that only ever blocks isn't proven either.
    const granted = evaluateOutboundSendPermission({
      capability: INTEGRATION_CAPABILITIES.SEND_EMAIL,
      channel: "email",
      outboundApproved: true,
    });
    if (!granted.allowed) {
      return {
        ok: false,
        reason: "outbound_gate_stuck_closed",
        message: "Outbound gate failed — send was blocked even after owner GRANT.",
      };
    }
    return {
      ok: true,
      simulated: false,
      gate: blocked,
      grantedGate: granted,
      message: "Outbound correctly blocked without owner GRANT, and correctly allowed after GRANT.",
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

  if (action === PROVE_ACTIONS.book_test_slot) {
    const { bookConfirmedAppointment } = await import(
      "../../../../../../../backend/core/integrations/appointment-setter/bookConfirmedAppointment.js"
    );
    const { getSystemWorkspaceForBusiness } = await import("@/lib/platform/getSystemWorkspaceForBusiness");
    const getWorkspace = async (id: string) => (await getSystemWorkspaceForBusiness(id)).service;
    const testPhone = normalizeBookTestSlotPhone(input.provePhone) || "+15555550100";
    const start = new Date(Date.now() + 60 * 60 * 1000);
    let booking: any = null;
    try {
      booking = await bookConfirmedAppointment({
        businessId: input.businessId,
        name: "VIBETech Prove Test",
        phone: testPhone,
        slot: { startISO: start.toISOString() },
        source: "prove",
        speech: "Live slot prove — safe to cancel from the calendar.",
        getWorkspace,
      });
    } catch (err) {
      return {
        ok: false,
        reason: "book_test_slot_error",
        message: err instanceof Error ? err.message : "Could not book a live test slot.",
      };
    }
    if (!booking?.ok || !booking?.confirmed) {
      return {
        ok: false,
        reason: booking?.reason ?? "book_test_slot_not_confirmed",
        message: "Connect Google Calendar so the appointment setter can confirm a live slot booking.",
        detail: booking,
      };
    }
    return {
      ok: true,
      simulated: false,
      liveSlotBook: true,
      confirmed: true,
      externalReference: booking?.event?.externalReference ?? null,
      workId: booking?.work?.workId ?? null,
      message: "Live test slot booked and confirmed on the connected Google Calendar.",
      detail: booking,
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
    knowledgeCount: input.knowledgeCount ?? null,
    outboundApproved: input.outboundApproved,
  });
}

function normalizeBookTestSlotPhone(raw: string | null | undefined): string {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const digits = text.replace(/\D/g, "");
  if (text.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return text.replace(/[\s()-]/g, "");
}
