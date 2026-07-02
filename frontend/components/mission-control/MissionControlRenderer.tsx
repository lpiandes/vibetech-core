"use client";

import type { MissionControlViewModel } from "./MissionControlContext";
import MissionControlContextProvider from "./MissionControlContext";
import MissionControlLayout from "./MissionControlLayout";
import MissionControlAlertRenderer from "./MissionControlAlertRenderer";

export default function MissionControlRenderer({ viewModel }: { viewModel: MissionControlViewModel }) {
  return (
    <MissionControlContextProvider viewModel={viewModel}>
      <div className="w-full max-w-6xl mx-auto px-0">
        <MissionControlLayout />
        <MissionControlAlertRenderer />
      </div>
    </MissionControlContextProvider>
  );
}

