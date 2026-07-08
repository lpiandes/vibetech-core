"use client";

import type { MissionControlViewModel } from "./MissionControlContext";
import MissionControlContextProvider from "./MissionControlContext";
import ForYouExecutiveLayout from "./ForYouExecutiveLayout";

export default function MissionControlRenderer({ viewModel }: { viewModel: MissionControlViewModel }) {
  return (
    <MissionControlContextProvider viewModel={viewModel}>
      <ForYouExecutiveLayout />
    </MissionControlContextProvider>
  );
}
