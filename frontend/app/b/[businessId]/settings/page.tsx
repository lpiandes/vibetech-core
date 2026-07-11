import { auth } from "@/auth";
import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS, MEMBERSHIP_ROLE_LABELS } from "../../../../../backend/core/platform/permissions/rolePermissions.js";
import { platformStore } from "@/lib/server/compose";
import SettingsScreen from "@/components/settings/SettingsScreen";

export default async function SettingsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const session = await auth();
  const ctx = await getAuthorizedWorkspace(businessId);
  const canManageSettings = ctx.permissions.has(PERMISSIONS.SETTINGS_MANAGE);
  // Any member can open Settings for access requests + account; management panels stay permissioned.

  const knowledgeDocumentCount = await platformStore.countActiveKnowledgeDocuments(businessId);
  ctx.service.refreshOperationalState(knowledgeDocumentCount);
  const homeState = ctx.service.loadBusinessHomeViewModel({ activeKnowledgeDocumentCount: knowledgeDocumentCount });

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
      setupChecklist={canManageSettings ? homeState.checklist : []}
      checklistComplete={homeState.checklistComplete}
    />
  );
}
