import type { ReactNode } from "react";

import KnowledgeContextProvider from "./KnowledgeContext";
import KnowledgeLayout from "./KnowledgeLayout";
import type { KnowledgeViewModel } from "./KnowledgeContext";

export default function KnowledgeRenderer({ viewModel }: { viewModel: KnowledgeViewModel }) {
  return (
    <KnowledgeContextProvider viewModel={viewModel}>
      <div className="min-h-screen w-full bg-background text-foreground">
        <KnowledgeLayout />
      </div>
    </KnowledgeContextProvider>
  );
}

