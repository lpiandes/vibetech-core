"use client";

import type { MissionControlViewModel } from "./MissionControlContext";
import MissionControlContextProvider from "./MissionControlContext";
import ForYouExecutiveLayout from "./ForYouExecutiveLayout";
import MissionControlExperience from "./MissionControlExperience";

/**
 * Mission Control is the living-business supervisor for installed Business OS.
 * For You remains the attention-only surface.
 */
export default function MissionControlRenderer({
  viewModel,
  variant = "mission_control",
}: {
  viewModel: MissionControlViewModel;
  variant?: "mission_control" | "for_you";
}) {
  return (
    <MissionControlContextProvider viewModel={viewModel}>
      {variant === "for_you" ? <ForYouExecutiveLayout /> : <MissionControlExperience />}
    </MissionControlContextProvider>
  );
}
