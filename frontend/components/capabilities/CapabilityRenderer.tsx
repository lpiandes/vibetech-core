import type { ReactNode } from "react";

import CapabilityContextProvider from "./CapabilityContext";
import CapabilityLayout from "./CapabilityLayout";

export default function CapabilityRenderer({ viewModel }: { viewModel: any }) {
  return (
    <CapabilityContextProvider viewModel={viewModel}>
      <div className="min-h-screen w-full bg-background text-foreground">
        <div className="px-4 py-6">
          <div className="text-2xl font-semibold">Capabilities</div>
          <div className="mt-4">
            <CapabilityLayout />
          </div>
        </div>
      </div>
    </CapabilityContextProvider>
  );
}

