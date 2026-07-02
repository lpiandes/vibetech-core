"use client";

import type { MissionControlViewModel } from "./MissionControlContext";
import { MissionControlViewModelContext } from "./MissionControlContext";
import { useContext } from "react";
import MissionControlHero from "./MissionControlHero";
import MissionControlSectionRenderer from "./MissionControlSectionRenderer";

export default function MissionControlLayout() {
  const viewModel = useContext<MissionControlViewModel | null>(MissionControlViewModelContext);
  if (!viewModel) return null;

  return (
    <div className="space-y-4">
      <MissionControlHero />
      <div className="space-y-4">
        {Array.isArray(viewModel.sections) ? (
          viewModel.sections.map((s: any) => <MissionControlSectionRenderer key={String(s.id)} sectionId={String(s.id)} />)
        ) : null}
      </div>
    </div>
  );
}

