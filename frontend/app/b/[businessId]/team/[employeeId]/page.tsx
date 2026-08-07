import { notFound, redirect } from "next/navigation";

import AiTeammateDetail from "@/components/team/AiTeammateDetail";
import { employeeStatusTone } from "@/components/team/teamSemantics";
import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { platformStore } from "@/lib/server/compose";
import { mergeBosEmployeesForTeam } from "@/lib/team/mergeBosEmployeesForTeam.js";
import { PERMISSIONS } from "../../../../../../backend/core/platform/permissions/rolePermissions.js";

export default async function AiTeammatePage({
  params,
}: {
  params: Promise<{ businessId: string; employeeId: string }>;
}) {
  const { businessId, employeeId: rawEmployeeId } = await params;
  const employeeId = decodeURIComponent(rawEmployeeId);

  // Pack / specialty AIs always use the specialty path editor — not the weaker AiTeammateDetail page.
  if (
    employeeId.startsWith("owner_emp_")
    || employeeId.startsWith("specialty_ai_")
    || employeeId.startsWith("emp_pack_")
    || employeeId.startsWith("emp_")
  ) {
    redirect(`/b/${businessId}/specialty/${encodeURIComponent(
      employeeId.startsWith("specialty_ai_")
        ? employeeId.slice("specialty_ai_".length)
        : employeeId,
    )}`);
  }

  return runTimedPage("team-employee", async () => {
    const ctx = await getAuthorizedWorkspace(businessId);
    if (!ctx.permissions.has(PERMISSIONS.TEAM_INVITE) && !ctx.permissions.has(PERMISSIONS.TEAM_MANAGE)) {
      redirect(`/b/${businessId}/home`);
    }

    const [knowledgeDocumentCount, installation] = await Promise.all([
      platformStore.countActiveKnowledgeDocuments(businessId),
      platformStore.getBusinessOSInstallation(businessId).catch(() => null),
    ]);

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

    const bosEmployees = mergeBosEmployeesForTeam({
      configuration: installation?.configuration ?? null,
      specification,
    });

    ctx.service.refreshOperationalState(knowledgeDocumentCount, {
      bosEmployeeDefinitions: bosEmployees.length ? bosEmployees : null,
    });
    const viewModel = ctx.service.loadTeamViewModel() as {
      digitalEmployees?: Array<Record<string, unknown>>;
    };
    const digitalEmployees = Array.isArray(viewModel.digitalEmployees) ? viewModel.digitalEmployees : [];
    const employee = digitalEmployees.find(
      (entry) => String(entry.employeeId ?? entry.id) === employeeId,
    );

    const bosEmployee = bosEmployees.find(
      (entry: { employeeId?: string; id?: string }) =>
        String(entry.employeeId ?? entry.id) === employeeId,
    );

    if (!employee && !bosEmployee) {
      notFound();
    }

    const name = String(employee?.name ?? bosEmployee?.label ?? bosEmployee?.name ?? "Operating responsibility");
    const purpose = String(
      employee?.description
        ?? employee?.responsibility
        ?? bosEmployee?.purpose
        ?? bosEmployee?.role
        ?? "",
    );
    const role = String(employee?.role ?? purpose ?? "");
    const ownerAdded = Boolean(
      employee?.ownerAdded
      || employee?.customAiWork
      || bosEmployee?.ownerAdded
      || employeeId.startsWith("owner_emp_"),
    );
    if (ownerAdded) {
      redirect(`/b/${businessId}/specialty/${encodeURIComponent(employeeId)}`);
    }
    const askAssisted = Boolean(employee?.askAssisted || ownerAdded);
    const canRunJobs = Boolean(employee?.canRunJobs || ownerAdded || employee?.isReady);
    const statusLabel = String(
      employee?.statusLabel ?? (canRunJobs ? "Ready to work" : "Getting ready"),
    );
    const blockers = Array.isArray(employee?.blockerItems)
      ? (employee.blockerItems as string[]).filter(Boolean)
      : [];
    const setupHref = employee?.setupHref ? String(employee.setupHref) : null;
    const askHref = String(
      employee?.askHref
        ?? `/b/${encodeURIComponent(businessId)}/architect?employeeId=${encodeURIComponent(employeeId)}`,
    );

    const automations = (ctx.service as any).connected?.ctx?.automationRuntime?.getAutomations?.() ?? [];
    const linked = automations.filter((auto: { id?: string; metadata?: { employeeId?: string } }) => {
      const linkedId = String(auto?.metadata?.employeeId ?? "");
      return linkedId === employeeId || String(auto?.id ?? "").includes(employeeId);
    });
    const automationsActive = linked.length
      ? linked.some((auto: { status?: string }) => String(auto.status).toUpperCase() === "ACTIVE")
      : null;

    const canDoToday = [
      "Run specialty jobs that create Work + reviewable artifacts",
      "Draft with you in Ask VibeTech",
      "Prepare customer messages that wait for your approval before sending",
    ];

    const cannotDoYet = [
      "Send email, SMS, or customer-facing messages without owner or manager approval",
    ];

    return (
      <AiTeammateDetail
        model={{
          employeeId,
          name,
          role,
          purpose,
          statusLabel,
          statusTone: employeeStatusTone({
            statusKey: String(employee?.statusKey ?? employee?.status ?? ""),
            statusLabel,
            isReady: Boolean(employee?.isReady || canRunJobs),
            askAssisted,
          }),
          ownerAdded,
          askAssisted,
          canRunJobs,
          canDoToday,
          cannotDoYet,
          blockers,
          askHref,
          setupHref,
          workHref: `/b/${businessId}/work`,
          teamHref: `/b/${businessId}/team`,
          businessId,
          automationsActive,
        }}
      />
    );
  });
}
