import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/compose";
import { getDevInvitationLink } from "@/lib/server/compose";
import { PERMISSIONS } from "../../../../../backend/core/platform/permissions/rolePermissions.js";
import { MEMBERSHIP_ROLE_LABELS } from "../../../../../backend/core/platform/permissions/rolePermissions.js";
import TeamRenderer from "@/components/team/TeamRenderer";
import { composeOrganizationView } from "@/lib/workforce/composeOrganizationView.js";
import { WorkforceEngine } from "../../../../../backend/core/workforce/WorkforceEngine.js";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";
import { mergeBosEmployeesForTeam } from "@/lib/team/mergeBosEmployeesForTeam.js";
import { ensureSpecialtyDigitalEmployees } from "@/lib/team/ensureSpecialtyDigitalEmployees.js";

const isDev = process.env.NODE_ENV !== "production";

export default async function TeamPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("team", async () => {
    const ctx = await getAuthorizedWorkspace(businessId);
    if (!ctx.permissions.has(PERMISSIONS.TEAM_INVITE) && !ctx.permissions.has(PERMISSIONS.TEAM_MANAGE)) {
      const { redirect } = await import("next/navigation");
      redirect(`/b/${businessId}/home`);
    }

    const [knowledgeDocumentCount, members, pending, installation] = await Promise.all([
      platformStore.countActiveKnowledgeDocuments(businessId),
      platformStore.listMembershipsForBusiness(businessId),
      platformStore.listPendingInvitationsForBusiness(businessId),
      platformStore.getBusinessOSInstallation(businessId).catch(() => null),
    ]);
    markRequestTiming("TEAM_DB");

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
    const loaded = ctx.service.loadTeamViewModel() as Record<string, unknown>;
    const digitalEmployees = ensureSpecialtyDigitalEmployees({
      digitalEmployees: Array.isArray(loaded.digitalEmployees) ? loaded.digitalEmployees : [],
      bosEmployees,
      businessId,
    });
    // Prefer specialty / owner-added teammates at the top of the roster.
    digitalEmployees.sort((a: { ownerAdded?: boolean; customAiWork?: boolean; name?: string }, b: { ownerAdded?: boolean; customAiWork?: boolean; name?: string }) => {
      const aScore = a.ownerAdded || a.customAiWork ? 0 : 1;
      const bScore = b.ownerAdded || b.customAiWork ? 0 : 1;
      if (aScore !== bScore) return aScore - bScore;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });
    const viewModel = { ...loaded, digitalEmployees };
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(viewModel).length });

    const memberEmails = new Set(members.map((m: { email: string }) => String(m.email).toLowerCase()));
    const filteredPending = pending.filter((p: { email: string }) => !memberEmails.has(String(p.email).toLowerCase()));

    const platformMembers = members.map((m: { userId: string; userName?: string; email: string; role: string }) => ({
      id: m.userId,
      name: m.userName || m.email,
      email: m.email,
      roleLabel: MEMBERSHIP_ROLE_LABELS[m.role as keyof typeof MEMBERSHIP_ROLE_LABELS] ?? m.role,
    }));

    let configuration = installation?.configuration
      ? { ...installation.configuration, employees: bosEmployees }
      : { employees: bosEmployees };
    let workforceOrganization = null;
    try {
      if (!configuration?.employees?.length) {
        const industry = (ctx as any).authz?.business?.industry
          ?? (ctx as any).service?.businessProfile?.industry
          ?? "default";
        const recommended = new WorkforceEngine().recommendOrganization({
          businessSummary: { industry },
        });
        workforceOrganization = recommended.organization;
        if (!configuration) {
          configuration = recommended.businessOsMapping;
        }
      }
    } catch {
      configuration = configuration ?? null;
      workforceOrganization = null;
    }

    const organization = composeOrganizationView({
      configuration,
      workforceOrganization,
      platformMembers,
      digitalEmployees: (viewModel as any)?.digitalEmployees ?? [],
    });

    return (
      <TeamRenderer
        viewModel={viewModel}
        organization={organization}
        platformTeam={{
          members: platformMembers,
          pending: filteredPending.map((p: { id: string; email: string; role: string }) => ({
            id: p.id,
            email: p.email,
            roleLabel: MEMBERSHIP_ROLE_LABELS[p.role as keyof typeof MEMBERSHIP_ROLE_LABELS] ?? p.role,
            inviteUrl: isDev ? getDevInvitationLink(p.id) : null,
          })),
          businessId,
          canInvite: ctx.permissions.has(PERMISSIONS.TEAM_INVITE),
          canManage: ctx.permissions.has(PERMISSIONS.TEAM_MANAGE),
          showDevInviteLinks: isDev,
        }}
      />
    );
  });
}
