import AutomationsIndexExperience from "@/components/automations/AutomationsIndexExperience";
import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { redirectIfModuleDenied } from "@/lib/platform/enforceRoleModuleAccess";
import { platformStore } from "@/lib/server/compose";
import { presentAutomationPath } from "../../../../../backend/core/ai-builder/operating-contract/automationPath.js";
import { buildOperatingContract } from "../../../../../backend/core/ai-builder/operating-contract/buildOperatingContract.js";
import { resolveOperatingIndustry } from "../../../../../backend/core/ai-builder/mapPackAiRolesToSelectedEmployees.js";

export default async function AutomationsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const ctx = await getAuthorizedWorkspace(businessId);
  await redirectIfModuleDenied({ businessId, role: ctx.role, moduleId: "automations" });
  const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  const employees = Array.isArray(installation?.configuration?.employees)
    ? installation.configuration.employees
    : [];
  const industry = resolveOperatingIndustry({
    industry: installation?.configuration?.businessProfile?.industry,
    businessName: installation?.configuration?.businessProfile?.businessName,
    operatingPackId: installation?.configuration?.operatingPackId,
    configuration: installation?.configuration,
  });

  const runtimeAutos = (ctx.service as any)?.connected?.ctx?.automationRuntime?.getAutomations?.() ?? [];

  const teammates = employees.map((emp: any) => {
    const employeeId = String(emp.employeeId ?? emp.id);
    const built = buildOperatingContract({ employee: emp, industry });
    const path = presentAutomationPath({ contract: built.contract, schema: built.schema });
    const active = runtimeAutos.some((a: any) => {
      const linked = String(a?.metadata?.employeeId ?? "");
      return (linked === employeeId || String(a?.id ?? "").includes(employeeId))
        && String(a.status).toUpperCase() === "ACTIVE";
    }) || (Array.isArray(emp.automationDefinitions)
      && emp.automationDefinitions.some((a: any) => String(a.status).toUpperCase() === "ACTIVE"));

    return {
      employeeId,
      label: String(emp.label ?? emp.name ?? employeeId),
      active: Boolean(active),
      href: `/b/${encodeURIComponent(businessId)}/specialty/${encodeURIComponent(employeeId)}`,
      stepCount: path.steps?.length ?? 0,
      triggerLabel: String(built.contract?.trigger?.summary ?? path.triggerLabel ?? ""),
    };
  });

  return <AutomationsIndexExperience businessId={businessId} teammates={teammates} />;
}
