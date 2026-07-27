import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { proposeAutomationWithLlm } from "../../../../../../../../../backend/core/ai-builder/specialty/proposeAutomationWithLlm.js";
import {
  applyOperatingContractPatch,
  presentOperatingContract,
} from "../../../../../../../../../backend/core/ai-builder/operating-contract/buildOperatingContract.js";
import { resolveOperatingIndustry } from "../../../../../../../../../backend/core/ai-builder/mapPackAiRolesToSelectedEmployees.js";
import { readCrmState } from "../../../../../../../../../backend/core/crm/CrmStore.js";
import { checkAiAskQuota } from "../../../../../../../../../backend/core/ai-builder/AiAskQuotaService.js";
import { llmIsLiveAvailable } from "../../../../../../../../../backend/core/providers/createLlmProvider.js";

/**
 * POST { instruction, apply?: boolean }
 * LLM-first path+trigger propose; deterministic fallback.
 * Live LLM asks: 5 per automation per UTC day.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string; employeeId: string }> },
) {
  try {
    const { businessId, employeeId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.TEAM_MANAGE);
    const body = await request.json().catch(() => ({}));
    const instruction = String(body.instruction ?? "").trim();
    const apply = Boolean(body.apply);

    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }
    const employees = Array.isArray(installation.configuration?.employees)
      ? [...installation.configuration.employees]
      : [];
    const index = employees.findIndex(
      (e: { employeeId?: string; id?: string }) => String(e.employeeId ?? e.id) === String(employeeId),
    );
    const employee = index >= 0 ? employees[index] : { employeeId, label: employeeId };
    const industry = resolveOperatingIndustry({
      industry: installation?.configuration?.businessProfile?.industry,
      businessName: installation?.configuration?.businessProfile?.businessName,
      operatingPackId: installation?.configuration?.operatingPackId,
      configuration: installation?.configuration,
    });

    const crm = readCrmState(installation);
    const pipelines = (crm.pipelines ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      stages: (p.stages ?? []).map((s: any) => ({ id: s.id, label: s.label })),
    }));

    let quota = null as Awaited<ReturnType<typeof checkAiAskQuota>> | null;
    if (llmIsLiveAvailable()) {
      quota = await checkAiAskQuota({
        scope: "automation",
        businessId,
        employeeId,
        platformStore,
        consume: true,
      });
      if (!quota.allowed) {
        return NextResponse.json({
          ok: false,
          reason: "quota_exceeded",
          quota,
          error: quota.message,
        }, { status: 429 });
      }
    }

    const proposal = await proposeAutomationWithLlm({
      instruction,
      contract: employee.operatingContract ?? {},
      industry,
      pipelines,
    });
    if (!proposal.ok) {
      return NextResponse.json({ ok: false, ...proposal, quota }, { status: 400 });
    }

    if (!apply) {
      return NextResponse.json({
        ok: true,
        proposal,
        applied: false,
        quota,
      });
    }

    const actorId = String((ctx as any)?.authz?.user?.id ?? "owner");
    const patch: Record<string, unknown> = {
      automationPath: { ...proposal.proposedPath, customized: true },
    };
    if (proposal.proposedTrigger) {
      patch.trigger = proposal.proposedTrigger;
    }

    const result = applyOperatingContractPatch({
      employee,
      industry,
      patch,
      actorId,
      nowISO: new Date().toISOString(),
    });

    const nextEmployee: any = {
      ...employee,
      employeeId: String(employee.employeeId ?? employeeId),
      operatingContract: result.contract,
    };

    // Keep automationDefinitions eventTypes in sync when trigger changes
    if (proposal.proposedTrigger && Array.isArray(nextEmployee.automationDefinitions)) {
      const eventTypes = proposal.proposedTrigger.eventTypes ?? [];
      nextEmployee.automationDefinitions = nextEmployee.automationDefinitions.map((auto: any) => ({
        ...auto,
        status: auto.status,
        name: `${nextEmployee.label ?? employeeId} — ${result.contract.trigger?.summary || "specialty work"}`,
        metadata: {
          ...(auto.metadata ?? {}),
          employeeId,
          fromOperatingContract: true,
          eventTypes: Array.from(new Set([
            ...eventTypes,
            "SPECIALTY_JOB_REQUESTED",
            "SPECIALTY_SCHEDULE_DUE",
          ])),
          triggerSummary: result.contract.trigger?.summary ?? "",
        },
        trigger: {
          ...(auto.trigger ?? {}),
          mode: result.contract.trigger?.mode,
          eventTypes: eventTypes.length ? eventTypes : auto.trigger?.eventTypes,
          eventType: eventTypes[0] ?? auto.trigger?.eventType,
        },
      }));
    }

    if (index >= 0) employees[index] = nextEmployee;
    else employees.push(nextEmployee);

    await platformStore.upsertBusinessOSInstallation({
      id: installation.id ?? installation.installationId ?? `install_${businessId}`,
      businessId,
      specificationRowId: installation.specificationRowId ?? null,
      specificationId: installation.specificationId,
      specificationVersion: installation.specificationVersion ?? 1,
      specificationContentHash: installation.specificationContentHash
        ?? installation.contentHash
        ?? "path_nl_edit",
      planId: installation.planId ?? `plan_${businessId}`,
      status: installation.status ?? "installed",
      plan: installation.plan ?? {},
      actionCheckpoints: installation.actionCheckpoints ?? [],
      configuration: { ...(installation.configuration ?? {}), employees },
      history: [
        ...(Array.isArray(installation.history) ? installation.history : []),
        { at: new Date().toISOString(), action: "nl_automation_path_edit", employeeId, actorId, source: proposal.source },
      ],
      actorUserId: installation.actorUserId ?? actorId,
      installedAt: installation.installedAt ?? null,
    });

    return NextResponse.json({
      ok: true,
      applied: true,
      proposal,
      presentation: presentOperatingContract(result.contract, result.schema),
      quota,
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
