import type { ReactNode } from "react";

import WorkContextProvider from "./WorkContext";
import WorkLayout from "./WorkLayout";
import type { WorkViewModel } from "./WorkContext";

export default function WorkRenderer({ viewModel }: { viewModel: WorkViewModel }) {
  return (
    <WorkContextProvider viewModel={viewModel}>
      <div className="min-h-screen w-full bg-background text-foreground">
        <WorkLayout />
      </div>
    </WorkContextProvider>
  );
}

