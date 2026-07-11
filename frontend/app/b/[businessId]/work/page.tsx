import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/compose";
import WorkRenderer from "@/components/work/WorkRenderer";
import WorkflowWorkspace from "@/components/workflows/WorkflowWorkspace";
import ModuleRenderer from "@/components/workspace/ModuleRenderer";
import { composeWorkflowView } from "@/lib/workflows/composeWorkflowView.js";
import { WorkflowEngine } from "../../../../../backend/core/workflows/WorkflowEngine.js";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";

export default async function WorkPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("work", async () => {
    const { service } = await getAuthorizedWorkspace(businessId);
    const viewModel = service.loadWorkViewModel();
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(viewModel).length });

    let workflows: ReturnType<typeof composeWorkflowView>;
    try {
      const installation = await platformStore.getBusinessOSInstallation(businessId);
      const configuration = installation?.configuration ?? null;
      let specification: any = null;
      if (installation?.specificationId) {
        const specRow = await platformStore.getBusinessOSSpecification({
          businessId,
          specificationId: installation.specificationId,
        });
        specification = specRow?.specification ?? null;
      }

      const industry = String(specification?.industry ?? configuration?.industry ?? "default");
      const workItems = Array.isArray((viewModel as any)?.items)
        ? (viewModel as any).items
        : Array.isArray((viewModel as any)?.workItems)
          ? (viewModel as any).workItems
          : [];

      if (configuration?.workflowDefinitions?.length || specification?.workflowDefinitions?.length) {
        workflows = composeWorkflowView({
          configuration: {
            workflowDefinitions: configuration?.workflowDefinitions
              ?? specification?.workflowDefinitions
              ?? [],
            ...(configuration?.workflows ?? {}),
          },
          businessOsMapping: configuration?.workflows ?? null,
          workItems,
        } as any);
      } else {
        const recommended = (new WorkflowEngine() as any).recommendWorkflows({
          businessSummary: { industry },
          businessId,
        });
        workflows = composeWorkflowView({
          workflowModel: recommended.workflowModel,
          businessOsMapping: recommended.businessOsMapping,
          workItems,
        } as any);
      }
    } catch {
      const recommended = (new WorkflowEngine() as any).recommendWorkflows({
        businessSummary: { industry: "default" },
        businessId,
      });
      workflows = composeWorkflowView({
        workflowModel: recommended.workflowModel,
        businessOsMapping: recommended.businessOsMapping,
      } as any);
    }

    return (
      <ModuleRenderer moduleId="work">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <WorkflowWorkspace workflows={workflows as never} />
          <WorkRenderer viewModel={viewModel} />
        </div>
      </ModuleRenderer>
    );
  });
}
