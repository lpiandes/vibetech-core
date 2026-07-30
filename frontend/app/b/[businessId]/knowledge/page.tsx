import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { redirectIfModuleDenied } from "@/lib/platform/enforceRoleModuleAccess";
import { businessKnowledgeService } from "@/lib/server/compose";
import { PERMISSIONS } from "../../../../../backend/core/platform/permissions/rolePermissions.js";
import KnowledgeRenderer from "@/components/knowledge/KnowledgeRenderer";

export default async function KnowledgePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await getAuthorizedWorkspace(businessId);
  await redirectIfModuleDenied({ businessId, role: ctx.role, moduleId: "knowledge" });
  const documents = await businessKnowledgeService.listDocuments(businessId);
  ctx.service.refreshOperationalState(documents.length);
  const [viewModel, knowledgeContext] = await Promise.all([
    Promise.resolve(ctx.service.loadKnowledgeViewModel()),
    Promise.resolve(ctx.service.loadKnowledgeExecutiveContext()),
  ]);

  return (
    <KnowledgeRenderer
      viewModel={viewModel}
      platformKnowledge={{
        businessId,
        canManage: ctx.permissions.has(PERMISSIONS.KNOWLEDGE_MANAGE),
        documents: documents as never[],
      }}
      knowledgeContext={knowledgeContext}
    />
  );
}
