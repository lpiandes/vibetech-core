import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, getAuthorizedBusinessScope, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";
import { GmailInboundSyncService } from "../../../../../../../backend/core/integrations/gmail/GmailInboundSyncService.js";
import {
  applyRftLaunchPatch,
  evaluateRftLaunch,
  persistRftLaunch,
  readRftLaunch,
  normalizeRftServiceStandard,
  buildDefaultRevenueFollowThroughEmployee,
  seedRftOpportunity,
  progressRftOpportunity,
  runHistoricalObservation,
  readRftObservation,
  runHistoricalReplay,
  readRftReplay,
  persistRftReplay,
  enableShadowMode,
  markShadowPassed,
  recordShadowCorrection,
  readRftResponsibility,
  assertRftResponsibilityComplete,
  persistRftResponsibility,
  REQUIRED_RESPONSIBILITY_FIELDS,
  RESPONSIBILITY_FIELD_LABELS,
} from "../../../../../../../backend/core/ai-builder/operating-contract/rft/index.js";
import {
  refreshGovernedLearning,
  persistGovernedLearning,
} from "../../../../../../../backend/core/company-rules/governedLearning.js";

function connectionStatusesFrom(ctx: { service: unknown }) {
  const connected = (ctx.service as any)?.connected;
  const statuses: Record<string, string> = {};
  const snapshotConnections = connected?.connectedSystemsSnapshot?.connections ?? [];
  for (const conn of snapshotConnections) {
    if (conn?.id) statuses[String(conn.id)] = String(conn.status ?? "NOT_CONNECTED");
  }
  // Live runtime wins (post-OAuth heal / registry warm).
  const runtimeConnections =
    connected?.integrationPlatform?.connectionRuntime?.getConnections?.() ?? [];
  for (const conn of runtimeConnections) {
    const id = String(conn?.connectionType ?? "");
    if (!id) continue;
    statuses[id] = String(conn?.status ?? "NOT_CONNECTED");
  }
  // Legacy shape some callers still set.
  const legacy = connected?.connectedSystemsSnapshot?.connectionStatuses;
  if (legacy && typeof legacy === "object") {
    for (const [key, value] of Object.entries(legacy)) {
      if (value && typeof value === "object" && "status" in (value as object)) {
        statuses[key] = String((value as { status?: string }).status ?? "NOT_CONNECTED");
      } else if (value != null) {
        statuses[key] = String(value);
      }
    }
  }
  return statuses;
}

async function proofRecordsFor(businessId: string) {
  const proofs = await platformStore.listCapabilityProofRecords(businessId).catch(() => []);
  return Object.fromEntries(
    (proofs ?? []).map((row: any) => [
      row.capabilityId,
      { ok: row.ok, verified: row.verified, detail: row.detail },
    ]),
  );
}

function rftEmployee(installation: any) {
  return (installation.configuration?.employees ?? []).find(
    (e: any) => e?.operatingContract?.rft || e?.roleId === "revenue_follow_through",
  ) ?? buildDefaultRevenueFollowThroughEmployee();
}

function isLiveConnectedStatus(value: unknown) {
  const status = String(
    typeof value === "object" && value != null
      ? ((value as { status?: string }).status ?? "")
      : (value ?? ""),
  ).toUpperCase();
  return status === "CONNECTED" || status === "VERIFIED" || status === "PROVEN" || status === "OK";
}

function connectionStatusesFromCredentials(rows: any[] = []) {
  const statuses: Record<string, string> = {};
  for (const row of rows) {
    const provider = String(row?.providerType ?? "").toLowerCase();
    const id = String(row?.credentialId ?? "").toLowerCase();
    if (provider.includes("gmail") || id.includes("gmail") || id.startsWith("cred_gmail_")) {
      statuses.business_email = "CONNECTED";
    }
    if (
      provider.includes("calendar")
      || provider.includes("google_calendar")
      || id.includes("gcal")
      || id.includes("calendar")
      || id.startsWith("cred_gcal_")
    ) {
      statuses.calendar = "CONNECTED";
    }
    if (provider.includes("twilio_sms") || id.includes("twilio_sms") || provider.includes("sms")) {
      statuses.sms_channel = "CONNECTED";
    }
    if (provider.includes("twilio_voice") || id.includes("voice") || provider.includes("voice")) {
      statuses.voice_channel = "CONNECTED";
    }
    if (provider.includes("meta") || id.includes("meta")) {
      statuses.meta_lead_ads = "CONNECTED";
    }
  }
  return statuses;
}

/**
 * Snapshot is often stale after OAuth on cold serverless. Credentials + live
 * CONNECTED always win — never demote a durable connect back to NOT_CONNECTED.
 */
function mergeConnectionStatuses(
  snapshotStatuses: Record<string, string> = {},
  credentialStatuses: Record<string, string> = {},
) {
  const statuses: Record<string, string> = { ...snapshotStatuses };
  for (const [id, status] of Object.entries(credentialStatuses)) {
    if (isLiveConnectedStatus(status) || !isLiveConnectedStatus(statuses[id])) {
      statuses[id] = status;
    }
  }
  return statuses;
}

/**
 * GET — evaluated RFT launch path + observation/replay summaries
 * Light path: no WorkspaceService boot (Home already paid for that on SSR).
 * POST actions: confirm | observe | replay | enableShadow | passShadow | correctShadow | prove | goLive | attach_prove
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedBusinessScope(businessId, PERMISSIONS.WORK_VIEW);
    const installation = await getCachedBusinessOsInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "Installation not found" }, { status: 404 });
    }
    const credentialRows = await platformStore
      .listIntegrationCredentialsForWorkspace(businessId)
      .catch(() => []);
    const credentialStatuses = connectionStatusesFromCredentials(credentialRows);
    const snapshotStatuses: Record<string, string> = {};
    const snap = (installation as any)?.configuration?.connectedSystemsSnapshot?.connections;
    if (Array.isArray(snap)) {
      for (const conn of snap) {
        if (conn?.id) snapshotStatuses[String(conn.id)] = String(conn.status ?? "NOT_CONNECTED");
      }
    }
    // Credentials first in merge priority — snapshot only fills gaps / confirms live.
    const connectionStatuses = mergeConnectionStatuses(snapshotStatuses, credentialStatuses);
    const proofRecords = await proofRecordsFor(businessId);
    const evaluated = evaluateRftLaunch({ installation, connectionStatuses, proofRecords });
    const employee = rftEmployee(installation);
    const rft = normalizeRftServiceStandard(employee?.operatingContract?.rft ?? null);
    return NextResponse.json({
      ok: true,
      launch: evaluated,
      observation: readRftObservation(installation),
      replay: readRftReplay(installation),
      responsibility: readRftResponsibility(installation),
      responsibilityFields: REQUIRED_RESPONSIBILITY_FIELDS.map((field: string) => ({
        field,
        label: RESPONSIBILITY_FIELD_LABELS[field] ?? field,
      })),
      contract: {
        contractVersion: rft.contractVersion,
        contentHash: rft.contentHash,
        slaSummary: `Acknowledge within ${rft.sla.acknowledgeWithinMinutes} minutes`,
        approvalSummary: rft.approvalRules.customerFacingRequiresApproval
          ? "Customer-facing actions require approval"
          : "Customer-facing may auto when eligible",
      },
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    let installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "Installation not found" }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "").trim();
    const connectionStatuses = connectionStatusesFrom(ctx);
    const proofRecords = await proofRecordsFor(businessId);

    if (action === "observe") {
      const windowDays = Number(body.windowDays ?? 90) || 90;
      // Best-effort historical Gmail pull (newer_than) before composing baseline.
      try {
        const platform = (ctx.service as any)?.connected?.integrationPlatform ?? null;
        const connection = platform?.connectionRuntime?.getConnectionByType?.("business_email") ?? null;
        if (connection) {
          await new GmailInboundSyncService().sync({
            businessId,
            platformStore,
            installation,
            connection,
            credentialResolver: platform?.credentialResolver ?? null,
            maxResults: Math.min(200, Number(body.maxResults ?? 100) || 100),
            query: `newer_than:${windowDays}d`,
            actorId: "rft_observe",
          });
          installation = await platformStore.getBusinessOSInstallation(businessId);
        }
      } catch {
        /* sync failure still allows baseline from whatever is already stored */
      }

      const observation = await runHistoricalObservation({
        platformStore,
        installation,
        connectionStatuses,
        windowDays,
        actorId: "owner",
      });
      installation = await platformStore.getBusinessOSInstallation(businessId);
      const patched = applyRftLaunchPatch(readRftLaunch(installation), {
        observeCompleted: true,
        observeDetail: `Baseline · ${observation.events.length} events · ${windowDays}d`,
      });
      if (patched.ok) {
        await persistRftLaunch({
          platformStore,
          installation,
          launch: patched.launch,
          actorId: "owner",
        });
      }
      installation = await platformStore.getBusinessOSInstallation(businessId);
      return NextResponse.json({
        ok: true,
        observation,
        launch: evaluateRftLaunch({ installation, connectionStatuses, proofRecords }),
        message: "Baseline built from connected channel evidence.",
      });
    }

    if (action === "confirm") {
      const responsibilityGate = assertRftResponsibilityComplete(body.responsibility ?? {});
      if (!responsibilityGate.ok) {
        return NextResponse.json({
          ok: false,
          code: "responsibility_incomplete",
          message: "Complete every responsibility field before confirming Revenue Follow-Through.",
          missing: responsibilityGate.missing,
          responsibility: responsibilityGate.responsibility,
        }, { status: 400 });
      }
      await persistRftResponsibility({
        platformStore,
        installation,
        responsibility: responsibilityGate.responsibility,
        actorId: "owner",
      });
      installation = await platformStore.getBusinessOSInstallation(businessId);
      const employee = rftEmployee(installation);
      const rft = normalizeRftServiceStandard(employee?.operatingContract?.rft ?? null);
      const patched = applyRftLaunchPatch(readRftLaunch(installation), {
        confirmedContentHash: rft.contentHash,
        confirmedContractVersion: rft.contractVersion,
      });
      if (!patched.ok) {
        return NextResponse.json(patched, { status: 400 });
      }
      await persistRftLaunch({
        platformStore,
        installation,
        launch: patched.launch,
        actorId: "owner",
      });
      return NextResponse.json({ ok: true, launch: patched.launch, contractHash: rft.contentHash });
    }

    if (action === "replay") {
      const employee = rftEmployee(installation);
      const lastReplay = runHistoricalReplay({
        installation,
        contract: employee?.operatingContract ?? null,
      });
      let replayState = {
        ...readRftReplay(installation),
        lastReplay,
      };
      await persistRftReplay({
        platformStore,
        installation,
        replayState,
        actorId: "owner",
      });
      installation = await platformStore.getBusinessOSInstallation(businessId);
      if (lastReplay.passed) {
        const patched = applyRftLaunchPatch(readRftLaunch(installation), {
          replayPassed: true,
          replayDetail: lastReplay.passDetail,
        });
        if (patched.ok) {
          await persistRftLaunch({
            platformStore,
            installation,
            launch: patched.launch,
            actorId: "owner",
          });
        }
      }
      installation = await platformStore.getBusinessOSInstallation(businessId);
      return NextResponse.json({
        ok: true,
        replay: lastReplay,
        launch: evaluateRftLaunch({ installation, connectionStatuses, proofRecords }),
      });
    }

    if (action === "enableShadow") {
      const replayState = enableShadowMode(readRftReplay(installation));
      await persistRftReplay({
        platformStore,
        installation,
        replayState,
        actorId: "owner",
      });
      installation = await platformStore.getBusinessOSInstallation(businessId);
      return NextResponse.json({
        ok: true,
        replay: readRftReplay(installation),
        launch: evaluateRftLaunch({ installation, connectionStatuses, proofRecords }),
        message: "Shadow mode on — live events propose without external sends.",
      });
    }

    if (action === "passShadow") {
      const result = markShadowPassed(readRftReplay(installation), {
        forceEmpty: body.forceEmpty === true,
      });
      if (!result.ok) {
        return NextResponse.json(result, { status: 400 });
      }
      await persistRftReplay({
        platformStore,
        installation,
        replayState: result.state,
        actorId: "owner",
      });
      installation = await platformStore.getBusinessOSInstallation(businessId);
      const patched = applyRftLaunchPatch(readRftLaunch(installation), {
        shadowPassed: true,
        shadowDetail: "Shadow review passed.",
      });
      if (patched.ok) {
        await persistRftLaunch({
          platformStore,
          installation,
          launch: patched.launch,
          actorId: "owner",
        });
      }
      installation = await platformStore.getBusinessOSInstallation(businessId);
      return NextResponse.json({
        ok: true,
        replay: readRftReplay(installation),
        launch: evaluateRftLaunch({ installation, connectionStatuses, proofRecords }),
      });
    }

    if (action === "correctShadow") {
      const replayState = recordShadowCorrection(readRftReplay(installation), {
        note: String(body.note ?? "").trim() || "Owner correction",
        proposalId: body.proposalId ?? null,
        shouldHave: body.shouldHave ?? null,
        reasonCode: body.reasonCode ?? "owner_preference",
      });
      await persistRftReplay({
        platformStore,
        installation,
        replayState,
        actorId: "owner",
      });
      // Plan 10 — feed shadow corrections into governed learning.
      try {
        const install2 = await platformStore.getBusinessOSInstallation(businessId);
        const refreshed = refreshGovernedLearning(install2);
        await persistGovernedLearning({
          platformStore,
          installation: install2,
          state: refreshed.state,
          actorId: "owner",
        });
      } catch {
        // Learning must not block shadow correction.
      }
      return NextResponse.json({ ok: true, replay: replayState });
    }

    if (action === "prove") {
      const seeded = await seedRftOpportunity({
        platformStore,
        installation,
        contact: body.contact ?? {
          name: "Launch prove contact",
          email: (ctx.user as any)?.email ?? installation?.configuration?.businessProfile?.ownerEmail ?? "",
        },
        title: body.title ?? "Launch prove opportunity",
        triggerEvent: "WEBSITE_INQUIRY",
        actorId: "owner",
      });
      if (!seeded.ok) {
        return NextResponse.json({ ok: false, error: "Could not seed prove opportunity" }, { status: 400 });
      }
      let install = await platformStore.getBusinessOSInstallation(businessId);
      for (const toState of ["ContextReady", "ActionProposed", "ApprovalRequired", "Executing"]) {
        install = await platformStore.getBusinessOSInstallation(businessId);
        await progressRftOpportunity({
          platformStore,
          installation: install,
          cardId: seeded.cardId,
          toState,
          actorId: "owner",
          note: "Launch prove path",
        });
      }
      install = await platformStore.getBusinessOSInstallation(businessId);
      const patched = applyRftLaunchPatch(readRftLaunch(install), { proveCardId: seeded.cardId });
      if (patched.ok) {
        await persistRftLaunch({
          platformStore,
          installation: install,
          launch: patched.launch,
          actorId: "owner",
        });
      }
      return NextResponse.json({
        ok: true,
        cardId: seeded.cardId,
        message: "Prove opportunity seeded. Run email/calendar/forms prove to attach provider evidence and reach Verified.",
        nextProveActions: ["send_test_email", "create_test_event", "submit_test_form"],
      });
    }

    if (action === "attach_prove") {
      return NextResponse.json({
        ok: false,
        code: "attach_prove_disabled",
        message: "Attach prove evidence through the server integrations prove route only.",
      }, { status: 403 });
    }

    if (action === "goLive") {
      const responsibilityGate = assertRftResponsibilityComplete(readRftResponsibility(installation));
      if (!responsibilityGate.ok) {
        return NextResponse.json({
          ok: false,
          code: "responsibility_incomplete",
          message: "Go-live blocked until the responsibility document is complete.",
          missing: responsibilityGate.missing,
          responsibility: responsibilityGate.responsibility,
        }, { status: 400 });
      }
      const evaluated = evaluateRftLaunch({ installation, connectionStatuses, proofRecords });
      if (!evaluated.summary.canGoLive) {
        return NextResponse.json({
          ok: false,
          code: "not_ready",
          message: evaluated.steps.goLive.detail,
          launch: evaluated,
        }, { status: 400 });
      }
      const launch = readRftLaunch(installation);
      // Ensure gate timestamps exist when evaluate says ready from observation/replay stores
      const gated = applyRftLaunchPatch(launch, {
        observeCompleted: true,
        replayPassed: true,
        shadowPassed: true,
        observeDetail: launch.steps.observe?.detail,
        replayDetail: launch.steps.replay?.detail,
        shadowDetail: launch.steps.shadow?.detail,
      });
      const patched = applyRftLaunchPatch(gated.ok ? gated.launch : launch, { goLive: true });
      if (!patched.ok) {
        return NextResponse.json(patched, { status: 400 });
      }
      await persistRftLaunch({
        platformStore,
        installation,
        launch: patched.launch,
        actorId: "owner",
      });
      return NextResponse.json({ ok: true, launch: patched.launch });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
