import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import {
  applyOperatingContractPatch,
  presentOperatingContract,
} from "../../../../../../../../backend/core/ai-builder/operating-contract/buildOperatingContract.js";
import { resolveOperatingContractSchema } from "../../../../../../../../backend/core/ai-builder/operating-contract/OperatingContractSchemas.js";
import { resolveOperatingIndustry } from "../../../../../../../../backend/core/ai-builder/mapPackAiRolesToSelectedEmployees.js";

async function loadEmployees(businessId: string) {
  const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  let employees = Array.isArray(installation?.configuration?.employees)
    ? [...installation.configuration.employees]
    : [];
  if (!employees.length && installation?.specificationId) {
    const spec = await platformStore.getBusinessOSSpecification({
      businessId,
      specificationId: installation.specificationId,
      specificationVersion: installation.specificationVersion ?? null,
    }).catch(() => null);
    employees = Array.isArray(spec?.specification?.employeeDefinitions)
      ? [...spec.specification.employeeDefinitions]
      : [];
  }
  return { installation, employees };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; employeeId: string }> },
) {
  try {
    const { businessId, employeeId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.TEAM_MANAGE);
    const { installation, employees } = await loadEmployees(businessId);
    const employee = employees.find(
      (entry: { employeeId?: string; id?: string }) =>
        String(entry.employeeId ?? entry.id) === String(employeeId),
    ) ?? { employeeId, label: employeeId };

    const industry = resolveOperatingIndustry({
      industry: installation?.configuration?.businessProfile?.industry,
      businessName: installation?.configuration?.businessProfile?.businessName,
      operatingPackId: installation?.configuration?.operatingPackId,
      configuration: installation?.configuration,
    });

    const patched = applyOperatingContractPatch({
      employee,
      industry,
      patch: {},
    });
    const schema = resolveOperatingContractSchema({ employee, industry });
    return NextResponse.json({
      ok: true,
      employeeId,
      industry,
      contract: patched.contract,
      schema: {
        schemaId: schema.schemaId,
        scopeFields: schema.scopeFields,
        triggerDefaults: schema.triggerDefaults,
        executesDefaults: schema.executesDefaults,
      },
      presentation: presentOperatingContract(patched.contract, schema),
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ businessId: string; employeeId: string }> },
) {
  try {
    const { businessId, employeeId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.TEAM_MANAGE);
    const body = await request.json().catch(() => ({}));
    const { installation, employees } = await loadEmployees(businessId);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }

    const index = employees.findIndex(
      (entry: { employeeId?: string; id?: string }) =>
        String(entry.employeeId ?? entry.id) === String(employeeId),
    );
    const current = index >= 0
      ? employees[index]
      : { employeeId, label: String(body?.label ?? employeeId) };

    const industry = resolveOperatingIndustry({
      industry: installation?.configuration?.businessProfile?.industry,
      businessName: installation?.configuration?.businessProfile?.businessName,
      operatingPackId: installation?.configuration?.operatingPackId,
      configuration: installation?.configuration,
    });

    const actorId = String((ctx as any)?.user?.id ?? (ctx as any)?.authz?.actorUserId ?? "owner");
    const result = applyOperatingContractPatch({
      employee: current,
      industry,
      patch: {
        trigger: body.trigger,
        executes: body.executes,
        rules: body.rules,
        scope: body.scope,
        automationPath: body.automationPath,
      },
      actorId,
      nowISO: new Date().toISOString(),
    });

    const nextLabel = body.label != null
      ? String(body.label).trim() || String(current.label ?? current.name ?? employeeId)
      : String(current.label ?? current.name ?? employeeId);

    const nextEmployee = {
      ...current,
      employeeId: String(current.employeeId ?? current.id ?? employeeId),
      label: nextLabel,
      name: nextLabel,
      operatingContract: result.contract,
      communicationPermissions: {
        ...(current.communicationPermissions ?? {}),
        customerFacingRequiresApproval: result.contract.rules.customerFacingRequiresApproval,
      },
      approvalRequirements: result.contract.rules.approvalRequirements,
      prohibitedActions: result.contract.rules.prohibitedActions,
      connectionDependencies: result.contract.rules.connectionDependencies,
    };

    // Refresh linked automation display metadata from contract.
    const autos = Array.isArray(current.automationDefinitions) ? [...current.automationDefinitions] : [];
    const refreshed = autos.map((auto: any) => {
      if (String(auto?.employeeId ?? auto?.metadata?.employeeId ?? "") !== String(employeeId)
        && !String(auto?.automationId ?? "").includes(String(employeeId))) {
        return auto;
      }
      return {
        ...auto,
        name: `${nextLabel} — ${result.contract.trigger.summary || "specialty work"}`,
        metadata: {
          ...(auto.metadata ?? {}),
          employeeId,
          fromOperatingContract: true,
          triggerSummary: result.contract.trigger.summary,
          executesSummary: result.contract.executes.summary,
          scope: result.contract.scope.answers,
        },
        trigger: {
          ...(auto.trigger ?? {}),
          mode: result.contract.trigger.mode,
          eventTypes: result.contract.trigger.eventTypes,
          eventType: result.contract.trigger.eventTypes?.[0] ?? auto.trigger?.eventType,
        },
      };
    });
    nextEmployee.automationDefinitions = refreshed.length
      ? refreshed
      : current.automationDefinitions;

    const nextEmployees = [...employees];
    if (index >= 0) nextEmployees[index] = nextEmployee;
    else nextEmployees.push(nextEmployee);

    await platformStore.upsertBusinessOSInstallation({
      id: installation.id ?? installation.installationId ?? `install_${businessId}`,
      businessId,
      specificationRowId: installation.specificationRowId ?? null,
      specificationId: installation.specificationId,
      specificationVersion: installation.specificationVersion ?? 1,
      specificationContentHash: installation.specificationContentHash
        ?? installation.contentHash
        ?? "operating_contract_patch",
      planId: installation.planId ?? `plan_${businessId}`,
      status: installation.status ?? "installed",
      plan: installation.plan ?? {},
      actionCheckpoints: installation.actionCheckpoints ?? [],
      configuration: {
        ...(installation.configuration ?? {}),
        employees: nextEmployees,
      },
      history: [
        ...(Array.isArray(installation.history) ? installation.history : []),
        {
          at: new Date().toISOString(),
          action: "update_operating_contract",
          employeeId,
          actorId,
        },
      ],
      actorUserId: installation.actorUserId ?? actorId,
      installedAt: installation.installedAt ?? null,
    });

    const schema = resolveOperatingContractSchema({ employee: nextEmployee, industry });
    return NextResponse.json({
      ok: true,
      employeeId,
      label: nextLabel,
      contract: result.contract,
      completeness: result.completeness,
      presentation: presentOperatingContract(result.contract, schema),
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
