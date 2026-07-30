import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { redirectIfModuleDenied } from "@/lib/platform/enforceRoleModuleAccess";
import WorkRenderer from "@/components/work/WorkRenderer";
import ModuleRenderer from "@/components/workspace/ModuleRenderer";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";

/**
 * Owner Work surface — active work queue only.
 * Workflow schema / assembly stays in Architect, not the operating shell.
 */
export default async function WorkPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("work", async () => {
    const ctx = await getAuthorizedWorkspace(businessId);
    await redirectIfModuleDenied({ businessId, role: ctx.role, moduleId: "work" });
    const { service } = ctx;
    const viewModel = service.loadWorkViewModel();
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(viewModel).length });

    return (
      <ModuleRenderer moduleId="work">
        <WorkRenderer viewModel={viewModel} />
      </ModuleRenderer>
    );
  });
}
