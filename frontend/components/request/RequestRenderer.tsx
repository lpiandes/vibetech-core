import type { ReactNode } from "react";

import RequestContextProvider, { type RequestViewModel } from "./RequestContext";
import RequestLayout from "./RequestLayout";
import RequestErrorBoundary from "./RequestErrorBoundary";

export default function RequestRenderer({ viewModel, children }: { viewModel: RequestViewModel; children?: ReactNode }) {
  return (
    <RequestErrorBoundary>
      <RequestContextProvider viewModel={viewModel}>
        <div className="min-h-screen w-full bg-background text-foreground">
          <RequestLayout />
          {children ? children : null}
        </div>
      </RequestContextProvider>
    </RequestErrorBoundary>
  );
}

