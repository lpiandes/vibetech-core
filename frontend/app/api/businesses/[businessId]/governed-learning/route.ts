import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import {
  readGovernedLearning,
  refreshGovernedLearning,
  persistGovernedLearning,
  recordCorrection,
  approveProposal,
  rejectProposal,
  rollbackRule,
  runProposalReplay,
  EDIT_REASON_CODES,
} from "../../../../../../backend/core/company-rules/governedLearning.js";
import { applyOperatingContractPatch } from "../../../../../../backend/core/ai-builder/operating-contract/buildOperatingContract.js";
import { resolveOperatingIndustry } from "../../../../../../backend/core/ai-builder/mapPackAiRolesToSelectedEmployees.js";

function rftEmployee(installation: any) {
  return (installation?.configuration?.employees ?? []).find(
    (e: any) => e?.operatingContract?.rft || e?.roleId === "revenue_follow_through",
  ) ?? null;
}

/**
 * GET — governed learning state (corrections, proposals, versions)
 * POST actions: refresh | record | replay | approve | reject | rollback
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.KNOWLEDGE_MANAGE);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }
    const learning = readGovernedLearning(installation);
    return NextResponse.json({
      ok: true,
      learning,
      editReasonCodes: [...EDIT_REASON_CODES],
      honesty: "Proposals never auto-apply. Approve after replay to version a Company Rule.",
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
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.KNOWLEDGE_MANAGE);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "refresh").trim();
    const actorId = String((ctx as any)?.user?.id ?? (ctx as any)?.authz?.actorUserId ?? "owner");

    let installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }

    if (action === "refresh") {
      const refreshed = refreshGovernedLearning(installation);
      await persistGovernedLearning({
        platformStore,
        installation,
        state: refreshed.state,
        actorId,
      });
      return NextResponse.json({
        ok: true,
        learning: refreshed.state,
        created: refreshed.created,
        counts: refreshed.counts,
      });
    }

    if (action === "record") {
      const recorded = recordCorrection(readGovernedLearning(installation), {
        ...body.correction,
        source: body.correction?.source ?? "owner",
        actorId,
      });
      if (!recorded.ok) {
        return NextResponse.json(recorded, { status: 400 });
      }
      let state = recorded.state;
      const refreshed = refreshGovernedLearning({
        ...installation,
        configuration: { ...(installation.configuration ?? {}), governedLearning: state },
      });
      state = refreshed.state;
      await persistGovernedLearning({ platformStore, installation, state, actorId });
      return NextResponse.json({ ok: true, correction: recorded.correction, learning: state });
    }

    if (action === "replay") {
      const result = runProposalReplay(installation, body.proposalId);
      if (!result.ok) {
        return NextResponse.json(result, { status: 400 });
      }
      await persistGovernedLearning({
        platformStore,
        installation,
        state: result.state,
        actorId,
      });
      return NextResponse.json({ ok: true, replay: result.replay, learning: result.state });
    }

    if (action === "approve") {
      const approved = approveProposal(readGovernedLearning(installation), {
        proposalId: body.proposalId,
        actorId,
        requireReplayPass: body.requireReplayPass !== false,
      });
      if (!approved.ok) {
        return NextResponse.json(approved, { status: 400 });
      }
      let state = approved.state;

      // Apply RFT contract patch when the approved proposal carries one (never silent).
      const patch = approved.rule?.suggestedPatch;
      if (patch?.kind === "rft_patch" && patch.patch) {
        const emp = rftEmployee(installation);
        if (emp) {
          const industry = resolveOperatingIndustry({
            industry: installation?.configuration?.businessProfile?.industry,
            businessName: installation?.configuration?.businessProfile?.businessName,
            operatingPackId: installation?.configuration?.operatingPackId,
            configuration: installation?.configuration,
          });
          const result = applyOperatingContractPatch({
            employee: emp,
            industry,
            patch: patch.patch,
            actorId,
            nowISO: new Date().toISOString(),
          });
          const employees = [...(installation.configuration?.employees ?? [])];
          const idx = employees.findIndex(
            (e: any) => String(e.employeeId ?? e.id) === String(emp.employeeId ?? emp.id),
          );
          if (idx >= 0) {
            employees[idx] = { ...emp, operatingContract: result.contract };
            await platformStore.upsertBusinessOSInstallation({
              id: installation.id ?? installation.installationId ?? `install_${businessId}`,
              businessId,
              specificationRowId: installation.specificationRowId ?? null,
              specificationId: installation.specificationId,
              specificationVersion: installation.specificationVersion ?? 1,
              specificationContentHash: installation.specificationContentHash
                ?? installation.contentHash
                ?? "governed_learning_approve",
              planId: installation.planId ?? `plan_${businessId}`,
              status: installation.status ?? "installed",
              plan: installation.plan ?? {},
              configuration: {
                ...(installation.configuration ?? {}),
                employees,
                governedLearning: state,
              },
              installedAt: installation.installedAt ?? new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              updatedBy: actorId,
            });
            return NextResponse.json({ ok: true, rule: approved.rule, learning: state, contractPatched: true });
          }
        }
      }

      await persistGovernedLearning({ platformStore, installation, state, actorId });
      return NextResponse.json({ ok: true, rule: approved.rule, learning: state, contractPatched: false });
    }

    if (action === "reject") {
      const state = rejectProposal(readGovernedLearning(installation), {
        proposalId: body.proposalId,
        actorId,
        note: body.note ?? null,
      });
      await persistGovernedLearning({ platformStore, installation, state, actorId });
      return NextResponse.json({ ok: true, learning: state });
    }

    if (action === "rollback") {
      const rolled = rollbackRule(readGovernedLearning(installation), {
        ruleId: body.ruleId ?? null,
        reasonCode: body.reasonCode ?? null,
        actorId,
      });
      if (!rolled.ok) {
        return NextResponse.json(rolled, { status: 400 });
      }
      await persistGovernedLearning({
        platformStore,
        installation,
        state: rolled.state,
        actorId,
      });
      return NextResponse.json({
        ok: true,
        learning: rolled.state,
        restored: rolled.restored,
        deactivated: rolled.deactivated,
      });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
