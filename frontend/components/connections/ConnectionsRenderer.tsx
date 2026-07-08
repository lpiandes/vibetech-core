import { Suspense } from "react";
import ConnectionsContextProvider from "./ConnectionsContext";
import ConnectionsExecutiveLayout from "./ConnectionsExecutiveLayout";
import ConnectionsErrorBoundary from "./ConnectionsErrorBoundary";
import { ProductLoading } from "@/components/product";

export default function ConnectionsRenderer({ viewModel }: { viewModel: any }) {
  return (
    <ConnectionsErrorBoundary>
      <ConnectionsContextProvider viewModel={viewModel}>
        <Suspense fallback={<ProductLoading />}>
          <ConnectionsExecutiveLayout />
        </Suspense>
      </ConnectionsContextProvider>
    </ConnectionsErrorBoundary>
  );
}
