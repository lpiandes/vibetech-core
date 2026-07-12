"use client";

import type { MissionControlViewModel } from "./MissionControlContext";
import MissionControlContextProvider from "./MissionControlContext";
import ForYouExecutiveLayout from "./ForYouExecutiveLayout";
import OperatingHomeExperience from "@/components/operating/OperatingHomeExperience";

/**
 * Mission Control / Operating Home renderer for installed Business OS.
 * For You remains an attention-only surface (redirected to Needs Attention in nav).
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
      {variant === "for_you" ? <ForYouExecutiveLayout /> : <OperatingHomeExperience />}
    </MissionControlContextProvider>
  );
}
