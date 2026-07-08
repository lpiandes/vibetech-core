import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS, MEMBERSHIP_ROLE_LABELS } from "../../../../../backend/core/platform/permissions/rolePermissions.js";
import { platformStore } from "../../../../../backend/core/platform/persistence/PostgresPlatformStore.js";
import SettingsScreen from "@/components/settings/SettingsScreen";

export default async function SettingsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const session = await auth();
  const ctx = await getAuthorizedWorkspace(businessId);
  if (!ctx.permissions.has(PERMISSIONS.SETTINGS_MANAGE)) {
    redirect(`/b/${businessId}/home`);
  }

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
      canManageTeam={ctx.permissions.has(PERMISSIONS.TEAM_INVITE) || ctx.permissions.has(PERMISSIONS.TEAM_MANAGE)}
      canManageIntegrations={ctx.permissions.has(PERMISSIONS.INTEGRATIONS_MANAGE)}
      canManageKnowledge={ctx.permissions.has(PERMISSIONS.KNOWLEDGE_MANAGE)}
      setupChecklist={homeState.checklist}
      checklistComplete={homeState.checklistComplete}
    />
  );
}
