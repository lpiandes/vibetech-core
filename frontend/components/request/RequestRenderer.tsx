import type { ReactNode } from "react";

import RequestContextProvider, { type RequestViewModel } from "./RequestContext";
import RequestErrorBoundary from "./RequestErrorBoundary";
import RequestExecutiveLayout from "./RequestExecutiveLayout";

export default function RequestRenderer({ viewModel, children }: { viewModel: RequestViewModel; children?: ReactNode }) {
  return (
    <RequestErrorBoundary>
      <RequestContextProvider viewModel={viewModel}>
        <RequestExecutiveLayout />
        {children ? children : null}
      </RequestContextProvider>
    </RequestErrorBoundary>
  );
}

