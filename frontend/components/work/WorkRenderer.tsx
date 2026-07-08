import type { ReactNode } from "react";

import WorkContextProvider from "./WorkContext";
import WorkExecutiveLayout from "./WorkExecutiveLayout";
import type { WorkViewModel } from "./WorkContext";

export default function WorkRenderer({ viewModel }: { viewModel: WorkViewModel }) {
  return (
    <WorkContextProvider viewModel={viewModel}>
      <WorkExecutiveLayout />
    </WorkContextProvider>
  );
}

