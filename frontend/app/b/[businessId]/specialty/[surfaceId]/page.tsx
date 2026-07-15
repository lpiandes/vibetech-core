import { notFound } from "next/navigation";

import SpecialtySurfaceExperience from "@/components/specialty/SpecialtySurfaceExperience";
import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { platformStore } from "@/lib/server/compose";
import {
  AI_SURFACE_BLOCKS,
  MODULE_SURFACE_BLOCKS,
  compileSpecialtySurfacesOnSpecification,
  isCustomAiEmployee,
  specialtyAiModuleId,
} from "../../../../../../backend/core/ai-builder/specialty/SpecialtySurfaceCompiler.js";
import { hydrateSpecialtyArtifact } from "../../../../../../backend/core/ai-builder/specialty/SpecialtyArtifactComposer.js";
import { getDigitalEmployeeReadinessEntry } from "../../../../../../backend/core/industries/employees/digitalEmployeeReadinessHelpers.js";

export default async function SpecialtySurfacePage({
  params,
}: {
  params: Promise<{ businessId: string; surfaceId: string }>;
}) {
  const { businessId, surfaceId: rawSurfaceId } = await params;
  const surfaceId = decodeURIComponent(rawSurfaceId);

  return runTimedPage("specialty", async () => {
    const ctx = await getAuthorizedWorkspace(businessId);
    const knowledgeDocumentCount = await platformStore.countActiveKnowledgeDocuments(businessId);
    ctx.service.refreshOperationalState(knowledgeDocumentCount);

    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    let specification = null as any;
    if (installation?.specificationId) {
      try {
        const specRow = await platformStore.getBusinessOSSpecification({
          businessId,
          specificationId: installation.specificationId,
          specificationVersion: installation.specificationVersion ?? null,
        });
        specification = specRow?.specification ?? null;
      } catch {
        specification = null;
      }
    }

    const compiled = compileSpecialtySurfacesOnSpecification(
      {
        ...(specification ?? {}),
        modules: [
          ...(Array.isArray(specification?.modules) ? specification.modules : []),
          ...(Array.isArray(installation?.configuration?.modules)
            ? installation.configuration.modules
            : []),
        ],
        employeeDefinitions: [
          ...(Array.isArray(specification?.employeeDefinitions)
            ? specification.employeeDefinitions
            : []),
          ...(Array.isArray(installation?.configuration?.employees)
            ? installation.configuration.employees
            : []),
        ],
        businessId,
      },
      { businessId },
    );

    const modules = Array.isArray(compiled.modules) ? compiled.modules : [];
    const employees = Array.isArray(compiled.employeeDefinitions) ? compiled.employeeDefinitions : [];

    let module = modules.find((entry: { moduleId?: string }) => String(entry.moduleId) === surfaceId)
      ?? null;
    let employee = employees.find(
      (entry: { employeeId?: string; id?: string }) =>
        String(entry.employeeId ?? entry.id) === surfaceId,
    ) ?? null;

    if (!employee && module?.employeeId) {
      employee = employees.find(
        (entry: { employeeId?: string }) => String(entry.employeeId) === String(module.employeeId),
      ) ?? null;
    }

    if (!module && employee) {
      module = modules.find(
        (entry: { moduleId?: string }) => String(entry.moduleId) === specialtyAiModuleId(employee.employeeId),
      ) ?? {
        moduleId: specialtyAiModuleId(employee.employeeId),
        label: employee.label ?? employee.name,
        surfaceKind: "ai_teammate",
        blocks: AI_SURFACE_BLOCKS,
        employeeId: employee.employeeId,
        purpose: employee.purpose,
      };
    }

    if (!module && !employee) {
      notFound();
    }

    const surfaceKind = String(
      module?.surfaceKind
      ?? (employee && isCustomAiEmployee(employee) ? "ai_teammate" : "module"),
    ) as "module" | "ai_teammate";
    const employeeId = employee
      ? String(employee.employeeId)
      : (module?.employeeId ? String(module.employeeId) : null);
    const name = String(module?.label ?? employee?.label ?? employee?.name ?? surfaceId);
    const purpose = String(module?.purpose ?? employee?.purpose ?? employee?.role ?? "");
    const blocks = Array.isArray(module?.blocks) && module.blocks.length
      ? module.blocks.map(String)
      : (surfaceKind === "ai_teammate" ? [...AI_SURFACE_BLOCKS] : [...MODULE_SURFACE_BLOCKS]);

    const workRuntime = (ctx.service as any).workRuntime;
    const allWork = Array.isArray(workRuntime?.getWorkItems?.()) ? workRuntime.getWorkItems() : [];
    const workItems = allWork
      .filter((item: any) => {
        const metaEmp = String(item?.metadata?.employeeId ?? "");
        const assigned = String(item?.assignedTo ?? "");
        if (employeeId && (metaEmp === employeeId || assigned === employeeId)) return true;
        if (String(item?.workType) === "custom_ai_task" && surfaceKind === "ai_teammate") {
          return !employeeId || assigned === employeeId || metaEmp === employeeId;
        }
        return false;
      })
      .slice(-8)
      .reverse()
      .map((item: any) => {
        const artifact = hydrateSpecialtyArtifact({
          artifact: item.metadata?.artifact ?? null,
          label: name,
          purpose,
          instruction: item.description ?? item.metadata?.artifact?.diagram?.header?.subtitle ?? "",
          nowISO: item.updatedAt ?? item.createdAt ?? null,
        });
        return {
          id: String(item.id),
          title: String(item.title ?? item.id),
          status: String(item.status ?? ""),
          updatedAt: item.updatedAt ?? null,
          artifactTitle: artifact?.title ?? item.metadata?.artifact?.title ?? null,
          artifactBody: artifact?.body ?? item.metadata?.artifact?.body ?? null,
          artifact,
          workHref: `/b/${encodeURIComponent(businessId)}/work?workId=${encodeURIComponent(String(item.id))}`,
        };
      });

    const automations = (ctx.service as any).connected?.ctx?.automationRuntime?.getAutomations?.() ?? [];
    const linked = employeeId
      ? automations.filter((auto: any) => {
        const linkedId = String(auto?.metadata?.employeeId ?? "");
        return linkedId === employeeId || String(auto?.id ?? "").includes(employeeId);
      })
      : [];
    const automationsActive = linked.length
      ? linked.some((auto: any) => String(auto.status).toUpperCase() === "ACTIVE")
      : null;

    const readinessEntry = employeeId
      ? getDigitalEmployeeReadinessEntry(
        (ctx.service as any).connected?.employeeReadinessReport,
        employeeId,
      )
      : null;
    const missingKnowledge = Array.isArray(readinessEntry?.missingKnowledge)
      ? readinessEntry.missingKnowledge.map(String)
      : [];
    const missingConnections = [
      ...(Array.isArray(readinessEntry?.missingConnections) ? readinessEntry.missingConnections : []),
      ...(Array.isArray(readinessEntry?.missingCapabilities) ? readinessEntry.missingCapabilities : []),
    ].map(String);
    const readinessReady = readinessEntry
      ? Boolean(readinessEntry.ready ?? readinessEntry.operationalReady ?? missingKnowledge.length + missingConnections.length === 0)
      : null;
    const blockerSummary = Array.isArray(readinessEntry?.blockers) && readinessEntry.blockers.length
      ? readinessEntry.blockers.map((b: any) => String(b.message ?? b.type ?? "Setup needed")).join(" · ")
      : null;

    return (
      <SpecialtySurfaceExperience
        model={{
          businessId,
          surfaceId,
          surfaceKind,
          name,
          purpose,
          blocks,
          employeeId,
          statusLabel: readinessReady === false
            ? "Needs Knowledge or Connections"
            : surfaceKind === "ai_teammate"
              ? "Ready to work"
              : "Specialty workspace",
          askHref: employeeId
            ? `/b/${encodeURIComponent(businessId)}/architect?employeeId=${encodeURIComponent(employeeId)}`
            : `/b/${encodeURIComponent(businessId)}/architect`,
          workHref: `/b/${businessId}/work`,
          knowledgeHref: `/b/${businessId}/knowledge`,
          integrationsHref: `/b/${businessId}/integrations`,
          teamHref: `/b/${businessId}/team`,
          workItems,
          automationsActive,
          linkedAutomationCount: linked.length,
          readiness: readinessEntry
            ? {
              ready: readinessReady !== false,
              missingKnowledge,
              missingConnections,
              blockerSummary,
            }
            : null,
        }}
      />
    );
  });
}
