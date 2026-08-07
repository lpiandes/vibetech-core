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
import {
  buildCustomAiReadyChecklist,
  resolveCustomAiPublicStatus,
} from "../../../../../../backend/core/ai-builder/custom-ai/buildCustomAiReadyChecklist.js";
import {
  buildOperatingContract,
  presentOperatingContract,
} from "../../../../../../backend/core/ai-builder/operating-contract/buildOperatingContract.js";
import { resolveOperatingIndustry } from "../../../../../../backend/core/ai-builder/mapPackAiRolesToSelectedEmployees.js";
import { healReceptionistEmployeeIfNeeded } from "../../../../../../backend/core/platform/packages/thinSkuDefaultEmployees.js";
import { buildPathReadinessSnapshot } from "../../../../../../backend/core/ai-builder/operating-contract/automationPathReadiness.js";
import { isSocialScreeningReady } from "../../../../../../backend/core/integrations/social-screening/socialScreeningKeys.js";

/** Prefer installation employee records (runtime config) over frozen specification copies. */
function mergeEmployeesPreferInstallation(
  specEmployees: unknown,
  installEmployees: unknown,
) {
  const map = new Map<string, Record<string, unknown>>();
  for (const entry of Array.isArray(specEmployees) ? specEmployees : []) {
    const id = String((entry as { employeeId?: string; id?: string })?.employeeId
      ?? (entry as { id?: string })?.id
      ?? "").trim();
    if (!id) continue;
    map.set(id, entry as Record<string, unknown>);
  }
  for (const entry of Array.isArray(installEmployees) ? installEmployees : []) {
    const id = String((entry as { employeeId?: string; id?: string })?.employeeId
      ?? (entry as { id?: string })?.id
      ?? "").trim();
    if (!id) continue;
    const prior = map.get(id);
    map.set(id, prior ? { ...prior, ...(entry as object) } : (entry as Record<string, unknown>));
  }
  return [...map.values()];
}

async function persistHealedReceptionistEmployees(
  installation: any,
  businessId: string,
): Promise<any> {
  if (!installation?.configuration) return installation;
  const existing = Array.isArray(installation.configuration.employees)
    ? installation.configuration.employees
    : [];
  let changed = false;
  const employees = existing.map((entry: any) => {
    const healed = healReceptionistEmployeeIfNeeded(entry);
    if (healed !== entry) changed = true;
    return healed;
  });
  if (!changed) return installation;
  const nextConfiguration = {
    ...(installation.configuration ?? {}),
    employees,
  };
  try {
    await platformStore.upsertBusinessOSInstallation({
      id: installation.id ?? installation.installationId ?? `install_${businessId}`,
      businessId,
      specificationRowId: installation.specificationRowId ?? null,
      specificationId: installation.specificationId,
      specificationVersion: installation.specificationVersion ?? 1,
      specificationContentHash: installation.specificationContentHash
        ?? installation.contentHash
        ?? "heal_receptionist_triggers",
      planId: installation.planId ?? `plan_${businessId}`,
      status: installation.status ?? "installed",
      plan: installation.plan ?? {},
      actionCheckpoints: installation.actionCheckpoints ?? [],
      configuration: nextConfiguration,
      history: [
        ...(Array.isArray(installation.history) ? installation.history : []),
        {
          at: new Date().toISOString(),
          action: "heal_receptionist_triggers",
        },
      ],
      actorUserId: installation.actorUserId ?? null,
      installedAt: installation.installedAt ?? null,
    });
  } catch {
    /* best effort — still return healed in-memory for this render */
  }
  return { ...installation, configuration: nextConfiguration };
}

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

    const installationRaw = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    const installation = installationRaw
      ? await persistHealedReceptionistEmployees(installationRaw, businessId)
      : null;
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
        // Installation employees win over specification copies — operating contracts
        // and automation stubs are persisted on the installation, not the frozen spec.
        employeeDefinitions: mergeEmployeesPreferInstallation(
          specification?.employeeDefinitions,
          installation?.configuration?.employees,
        ),
        businessId,
      },
      { businessId },
    );

    const modules = Array.isArray(compiled.modules) ? compiled.modules : [];
    const employees = Array.isArray(compiled.employeeDefinitions) ? compiled.employeeDefinitions : [];

    let module = modules.find((entry: { moduleId?: string }) => String(entry.moduleId) === surfaceId)
      ?? null;
    // Prefer the installation-backed employee (has saved operating contract).
    const installEmployee = Array.isArray(installation?.configuration?.employees)
      ? installation.configuration.employees.find(
        (entry: { employeeId?: string; id?: string }) =>
          String(entry.employeeId ?? entry.id) === surfaceId,
      )
      : null;
    let employee = installEmployee
      ?? employees.find(
        (entry: { employeeId?: string; id?: string }) =>
          String(entry.employeeId ?? entry.id) === surfaceId,
      )
      ?? null;

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
      // Allow opening any teammate id from Team/Home even before specialty compile caught up.
      employee = {
        employeeId: surfaceId,
        label: surfaceId.replace(/^emp_(pack_)?/, "").replace(/_/g, " "),
        purpose: "Operating responsibility. Prepares work for your review and never sends without approval.",
        packDefault: String(surfaceId).startsWith("emp_pack_"),
        approvalRequirements: ["human_approval"],
        prohibitedActions: ["autonomous_customer_send"],
        communicationPermissions: { customerFacingRequiresApproval: true },
        connectionDependencies: ["business_email"],
      };
      module = {
        moduleId: specialtyAiModuleId(surfaceId),
        label: employee.label,
        surfaceKind: "ai_teammate",
        blocks: AI_SURFACE_BLOCKS,
        employeeId: surfaceId,
        purpose: employee.purpose,
      };
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
      : Array.isArray(employee?.automationDefinitions)
        ? employee.automationDefinitions.some((auto: any) => String(auto.status).toUpperCase() === "ACTIVE")
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

    const industry = resolveOperatingIndustry({
      industry: installation?.configuration?.businessProfile?.industry
        ?? specification?.businessProfile?.industry,
      businessName: installation?.configuration?.businessProfile?.businessName
        ?? specification?.businessProfile?.businessName,
      operatingPackId: installation?.configuration?.operatingPackId
        ?? specification?.operatingPackId,
      configuration: installation?.configuration,
      specification,
    });

    const contractBuilt = surfaceKind === "ai_teammate" && employee
      ? buildOperatingContract({
        employee,
        industry,
        discoverySummary: installation?.configuration?.businessSummary
          ?? specification?.businessProfile
          ?? null,
      })
      : null;

    const snapshotConnections = Array.isArray(
      (ctx.service as any)?.connected?.connectedSystemsSnapshot?.connections,
    )
      ? (ctx.service as any).connected.connectedSystemsSnapshot.connections
      : [];
    const runtimeConnections = (ctx.service as any)?.connected?.integrationPlatform
      ?.connectionRuntime?.getConnections?.() ?? [];
    const connections = snapshotConnections.length ? snapshotConnections : runtimeConnections;
    const smsConn = connections.find((c: any) => {
      const t = String(c?.connectionType ?? c?.type ?? "").toLowerCase();
      return t === "sms_channel" || t === "twilio_sms";
    });
    const readinessSnapshot = buildPathReadinessSnapshot({
      businessId,
      connections,
      appOrigin: process.env.APP_ORIGIN || process.env.NEXTAUTH_URL || "",
      crmAvailable: true,
      socialScreeningReady: isSocialScreeningReady({
        env: process.env,
        connection: connections.find((c: any) => {
          const t = String(c?.connectionType ?? c?.type ?? "").toLowerCase();
          return t === "social_screening";
        }),
      }),
      smsBrandComplete: smsConn
        ? (smsConn?.metadata?.brandComplete === true || smsConn?.metadata?.a2pBrandComplete === true)
        : null,
    });

    const contractPresentation = contractBuilt
      ? presentOperatingContract(contractBuilt.contract, contractBuilt.schema, readinessSnapshot)
      : null;

    const customAiChecklist = employee && isCustomAiEmployee(employee)
      ? buildCustomAiReadyChecklist(employee, {
        knowledgeCount: knowledgeDocumentCount,
        hasRunProve: workItems.length > 0,
      })
      : null;
    const customAiStatus = customAiChecklist
      ? resolveCustomAiPublicStatus(employee, {
        knowledgeCount: knowledgeDocumentCount,
        hasRunProve: workItems.length > 0,
      })
      : null;

    const contractIncomplete = contractBuilt && !contractBuilt.completeness.complete;
    const statusLabel = contractIncomplete
      ? contractPresentation?.statusLabel ?? "Needs setup"
      : customAiStatus
        ? customAiStatus.statusLabel
        : readinessReady === false
          ? "Needs Knowledge or Connections"
          : surfaceKind === "ai_teammate"
            ? workItems.length > 0
              ? "Operational — review recent work"
              : "Needs first test"
            : "Specialty workspace";

    const linkedAutomationRows = linked.map((auto: any) => ({
      id: String(auto.id ?? auto.automationId ?? ""),
      name: String(auto.name ?? "Automation"),
      status: String(auto.status ?? "INACTIVE"),
      triggerSummary: String(
        auto.metadata?.triggerSummary
        ?? contractBuilt?.contract?.trigger?.summary
        ?? auto.trigger?.eventType
        ?? "Linked automation",
      ),
    }));

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
          statusLabel,
          askHref: `/b/${encodeURIComponent(businessId)}/team`,
          workHref: `/b/${businessId}/work`,
          knowledgeHref: `/b/${businessId}/knowledge`,
          integrationsHref: `/b/${businessId}/integrations`,
          teamHref: `/b/${businessId}/team`,
          workItems,
          automationsActive,
          linkedAutomationCount: linked.length || (employee?.automationDefinitions?.length ?? 0),
          nextScheduleAt: employee?.operatingContract?.trigger?.schedule?.nextRunAt
            ?? null,
          linkedAutomations: linkedAutomationRows.length
            ? linkedAutomationRows
            : (Array.isArray(employee?.automationDefinitions)
              ? employee.automationDefinitions.map((auto: any) => ({
                id: String(auto.automationId ?? auto.id ?? ""),
                name: String(auto.name ?? "Automation"),
                status: String(auto.status ?? "INACTIVE"),
                triggerSummary: String(
                  auto.metadata?.triggerSummary
                  ?? contractBuilt?.contract?.trigger?.summary
                  ?? "From operating contract",
                ),
              }))
              : []),
          readyChecklist: customAiChecklist,
          operatingContract: contractPresentation,
          contractComplete: contractBuilt ? contractBuilt.completeness.complete : null,
          readiness: readinessEntry
            ? {
              ready: readinessReady !== false
                && (customAiStatus ? customAiStatus.isReady : true)
                && !contractIncomplete,
              missingKnowledge,
              missingConnections,
              blockerSummary: contractIncomplete
                ? contractPresentation?.statusLabel
                : blockerSummary,
            }
            : customAiChecklist
              ? {
                ready: customAiChecklist.ready && !contractIncomplete,
                missingKnowledge: [],
                missingConnections: [],
                blockerSummary: contractIncomplete
                  ? contractPresentation?.statusLabel
                  : (customAiChecklist.ready
                    ? null
                    : "Finish the ready checklist before this custom AI is Live."),
              }
              : contractIncomplete
                ? {
                  ready: false,
                  missingKnowledge: [],
                  missingConnections: [],
                  blockerSummary: contractPresentation?.statusLabel ?? null,
                }
                : null,
        }}
      />
    );
  });
}
