import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { platformStore } from "../../../../../backend/core/platform/persistence/PostgresPlatformStore.js";
import { PERMISSIONS } from "../../../../../backend/core/platform/permissions/rolePermissions.js";
import PropertiesRenderer from "@/components/properties/PropertiesRenderer";
import RecordsWorkspace from "@/components/data-forms/RecordsWorkspace";
import ModuleRenderer from "@/components/workspace/ModuleRenderer";
import { composeRecordsView } from "@/lib/data-forms/composeRecordsView.js";
import { DataFormsEngine } from "../../../../../backend/core/data-forms/DataFormsEngine.js";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";

export default async function PropertiesPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("properties", async () => {
    const { service } = await getAuthorizedWorkspace(businessId, PERMISSIONS.PEOPLE_VIEW);
    const portfolio = service.loadBusinessSubjectPortfolioIndex();
    const presentation = service.loadPortfolioPresentation();
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(portfolio).length });

    let records: ReturnType<typeof composeRecordsView>;
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

      if (configuration?.subjectDefinitions?.length || specification?.subjectDefinitions?.length) {
        const subjectTypes = (
          configuration?.subjectTypes
          ?? specification?.subjectDefinitions?.map((entry: any) => entry.subjectType)
          ?? []
        ).filter(Boolean).map(String);
        records = composeRecordsView({
          configuration: {
            subjectDefinitions: configuration?.subjectDefinitions
              ?? specification?.subjectDefinitions
              ?? [],
            ...(configuration?.dataForms ?? {}),
          },
          businessOsMapping: configuration?.dataForms ?? null,
          subjectTypes,
        } as any);
      } else {
        const recommended = (new DataFormsEngine() as any).recommendDataModel({
          businessSummary: { industry },
          businessId,
        });
        records = composeRecordsView({
          dataModel: recommended.dataModel,
          businessOsMapping: recommended.businessOsMapping,
        } as any);
      }
    } catch {
      const recommended = (new DataFormsEngine() as any).recommendDataModel({
        businessSummary: { industry: "default" },
        businessId,
      });
      records = composeRecordsView({
        dataModel: recommended.dataModel,
        businessOsMapping: recommended.businessOsMapping,
      } as any);
    }

    return (
      <ModuleRenderer moduleId="properties">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <RecordsWorkspace records={records as never} />
          <PropertiesRenderer businessId={businessId} portfolio={portfolio as never} presentation={presentation} />
        </div>
      </ModuleRenderer>
    );
  });
}
