"use client";

import type { MissionControlViewModel } from "./MissionControlContext";
import MissionControlContextProvider from "./MissionControlContext";
import MissionControlExecutiveLayout from "./MissionControlExecutiveLayout";

export default function MissionControlRenderer({ viewModel }: { viewModel: MissionControlViewModel }) {
  return (
    <MissionControlContextProvider viewModel={viewModel}>
      <MissionControlExecutiveLayout />
    </MissionControlContextProvider>
  );
}

