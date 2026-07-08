import { Suspense } from "react";
import KnowledgeContextProvider from "./KnowledgeContext";
import KnowledgeExecutiveLayout from "./KnowledgeExecutiveLayout";
import type { KnowledgeViewModel } from "./KnowledgeContext";
import type { KnowledgeExecutiveContext, PlatformKnowledgeDocument } from "./knowledgeSemantics";
import { ProductLoading } from "@/components/product";

export type { PlatformKnowledgeDocument } from "./knowledgeSemantics";

export type PlatformKnowledgeData = {
  documents: PlatformKnowledgeDocument[];
  businessId: string;
  canManage: boolean;
};

export default function KnowledgeRenderer({
  viewModel,
  platformKnowledge,
  knowledgeContext,
}: {
  viewModel: KnowledgeViewModel;
  platformKnowledge?: PlatformKnowledgeData;
  knowledgeContext?: KnowledgeExecutiveContext;
}) {
  return (
    <KnowledgeContextProvider viewModel={viewModel}>
      <Suspense fallback={<ProductLoading />}>
        <KnowledgeExecutiveLayout platformKnowledge={platformKnowledge} knowledgeContext={knowledgeContext} />
      </Suspense>
    </KnowledgeContextProvider>
  );
}
