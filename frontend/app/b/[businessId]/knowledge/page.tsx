import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { redirectIfModuleDenied } from "@/lib/platform/enforceRoleModuleAccess";
import { businessKnowledgeService, platformStore } from "@/lib/server/compose";
import { PERMISSIONS } from "../../../../../backend/core/platform/permissions/rolePermissions.js";
import KnowledgeRenderer from "@/components/knowledge/KnowledgeRenderer";
import CompanyRulesExperience from "@/components/company-rules/CompanyRulesExperience";
import { presentBusinessMemory } from "../../../../../backend/core/company-rules/presentBusinessMemory.js";

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

  const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  const { contracts, memoryValues } = presentBusinessMemory(installation);

  return (
    <CompanyRulesExperience
      businessId={businessId}
      contracts={contracts}
      memoryValues={memoryValues}
      knowledgeSlot={(
        <KnowledgeRenderer
          viewModel={viewModel}
          platformKnowledge={{
            businessId,
            canManage: ctx.permissions.has(PERMISSIONS.KNOWLEDGE_MANAGE),
            documents: documents as never[],
          }}
          knowledgeContext={knowledgeContext}
        />
      )}
    />
  );
}
