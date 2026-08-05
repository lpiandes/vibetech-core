import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { redirectIfModuleDenied } from "@/lib/platform/enforceRoleModuleAccess";
import { PERMISSIONS, MEMBERSHIP_ROLE_LABELS } from "../../../../../backend/core/platform/permissions/rolePermissions.js";
import { platformStore } from "@/lib/server/compose";
import SettingsScreen from "@/components/settings/SettingsScreen";
import { readPurchasedPackagesFromConfig } from "../../../../../backend/core/platform/packages/SalesPackageCatalog.js";
import { getCachedInstalledPortal } from "@/lib/platform/cachedInstalledPortal";

export default async function SettingsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await getAuthorizedWorkspace(businessId);
  await redirectIfModuleDenied({ businessId, role: ctx.role, moduleId: "settings" });
  const canManageSettings = ctx.permissions.has(PERMISSIONS.SETTINGS_MANAGE);

  const permissions = Array.from(ctx.permissions).map(String);
  const [knowledgeDocumentCount, teamInviteChecklistComplete, portal] = await Promise.all([
    platformStore.countActiveKnowledgeDocuments(businessId),
    platformStore.isTeamInviteChecklistComplete(businessId),
    getCachedInstalledPortal(businessId, String(ctx.role), permissions),
  ]);
  ctx.service.refreshOperationalState(knowledgeDocumentCount);

  const purchasedPackages = readPurchasedPackagesFromConfig(portal.installation?.configuration ?? {});
  const installedSpecification = portal.specification;

  const homeState = ctx.service.loadBusinessHomeViewModel({
    activeKnowledgeDocumentCount: knowledgeDocumentCount,
    teamInviteChecklistComplete,
    installedSpecification,
  });

  return (
    <SettingsScreen
      businessName={ctx.authz.business.name}
      businessId={businessId}
      userName={ctx.user?.name ?? ctx.user?.email ?? "User"}
      userEmail={ctx.user?.email ?? ""}
      roleLabel={MEMBERSHIP_ROLE_LABELS[ctx.role as keyof typeof MEMBERSHIP_ROLE_LABELS] ?? ctx.role}
      canManageTeam={canManageSettings && (ctx.permissions.has(PERMISSIONS.TEAM_INVITE) || ctx.permissions.has(PERMISSIONS.TEAM_MANAGE))}
      canManageIntegrations={canManageSettings && ctx.permissions.has(PERMISSIONS.INTEGRATIONS_MANAGE)}
      canManageKnowledge={canManageSettings && ctx.permissions.has(PERMISSIONS.KNOWLEDGE_MANAGE)}
      purchasedPackages={purchasedPackages}
      setupChecklist={canManageSettings ? homeState.checklist : []}
      checklistComplete={homeState.checklistComplete}
    />
  );
}
