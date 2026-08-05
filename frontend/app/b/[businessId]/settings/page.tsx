import { getAuthorizedBusinessScope } from "@/lib/platform/AuthorizedWorkspaceService";
import { redirectIfModuleDenied } from "@/lib/platform/enforceRoleModuleAccess";
import { PERMISSIONS, MEMBERSHIP_ROLE_LABELS } from "../../../../../backend/core/platform/permissions/rolePermissions.js";
import { platformStore } from "@/lib/server/compose";
import SettingsScreen from "@/components/settings/SettingsScreen";
import { readPurchasedPackagesFromConfig } from "../../../../../backend/core/platform/packages/SalesPackageCatalog.js";
import { getCachedInstalledPortal } from "@/lib/platform/cachedInstalledPortal";
import { buildPlatformSetupChecklist } from "../../../../../backend/core/operating-home/buildPlatformSetupChecklist.js";

export default async function SettingsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await getAuthorizedBusinessScope(businessId);
  const permissions = Array.from(ctx.permissions).map(String);
  const portal = await getCachedInstalledPortal(businessId, String(ctx.role), permissions);
  await redirectIfModuleDenied({
    businessId,
    role: ctx.role,
    moduleId: "settings",
    installation: portal.installation,
  });
  const canManageSettings = ctx.permissions.has(PERMISSIONS.SETTINGS_MANAGE);

  const [knowledgeDocumentCount, teamInviteChecklistComplete] = await Promise.all([
    platformStore.countActiveKnowledgeDocuments(businessId),
    platformStore.isTeamInviteChecklistComplete(businessId),
  ]);

  const purchasedPackages = readPurchasedPackagesFromConfig(portal.installation?.configuration ?? {});
  const checklist = canManageSettings
    ? buildPlatformSetupChecklist({
      workspaceId: businessId,
      requiredSetupSteps: ["email", "calendar"],
      connections: [],
      teamInviteChecklistComplete,
      knowledgeCount: knowledgeDocumentCount,
      includeTeamAndKnowledge: true,
    })
    : [];
  const checklistComplete = Array.isArray(checklist) && checklist.every((item: { complete?: boolean }) => item.complete);

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
      setupChecklist={checklist}
      checklistComplete={checklistComplete}
    />
  );
}
