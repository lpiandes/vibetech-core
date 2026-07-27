import { auth } from "@/auth";
import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS, MEMBERSHIP_ROLE_LABELS } from "../../../../../backend/core/platform/permissions/rolePermissions.js";
import { platformStore } from "@/lib/server/compose";
import SettingsScreen from "@/components/settings/SettingsScreen";
import { readPurchasedPackagesFromConfig } from "../../../../../backend/core/platform/packages/SalesPackageCatalog.js";

export default async function SettingsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const session = await auth();
  const ctx = await getAuthorizedWorkspace(businessId);
  const canManageSettings = ctx.permissions.has(PERMISSIONS.SETTINGS_MANAGE);

  const knowledgeDocumentCount = await platformStore.countActiveKnowledgeDocuments(businessId);
  ctx.service.refreshOperationalState(knowledgeDocumentCount);

  let installedSpecification: Record<string, unknown> | null = null;
  let purchasedPackages: string[] = [];
  try {
    const installation = await platformStore.getBusinessOSInstallation(businessId);
    purchasedPackages = readPurchasedPackagesFromConfig(installation?.configuration ?? {});
    if (installation?.specificationId) {
      const specRow = await platformStore.getBusinessOSSpecification({
        businessId,
        specificationId: installation.specificationId,
      });
      const specification = specRow?.specification ?? null;
      installedSpecification = specification && typeof specification === "object"
        ? (specification as Record<string, unknown>)
        : null;
    }
  } catch {
    installedSpecification = null;
  }

  const homeState = ctx.service.loadBusinessHomeViewModel({
    activeKnowledgeDocumentCount: knowledgeDocumentCount,
    teamInviteChecklistComplete: await platformStore.isTeamInviteChecklistComplete(businessId),
    installedSpecification,
  });

  return (
    <SettingsScreen
      businessName={ctx.authz.business.name}
      businessId={businessId}
      userName={session?.user?.name ?? session?.user?.email ?? "User"}
      userEmail={session?.user?.email ?? ""}
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
