"use client";

import { useContext } from "react";

import type { TeamViewModel } from "./TeamContext";
import { TeamViewModelContext } from "./TeamContext";
import TeamSummary from "./TeamSummary";
import DepartmentRenderer from "./DepartmentRenderer";
import MemberRenderer from "./MemberRenderer";
import WorkloadRenderer from "./WorkloadRenderer";
import AttentionRenderer from "./AttentionRenderer";
import RecommendationRenderer from "./RecommendationRenderer";

function layoutClass(layout: string) {
  switch (layout) {
    case "twoColumn":
      return "grid grid-cols-1 md:grid-cols-2 gap-4";
    case "single":
    default:
      return "grid grid-cols-1 gap-4";
  }
}

export default function TeamLayout() {
  const viewModel = useContext<TeamViewModel | null>(TeamViewModelContext);
  if (!viewModel) return null;

  const layout = String(viewModel?.metadata?.layout ?? "single");
  const grid = layoutClass(layout);

  return (
    <div className="mx-auto w-full max-w-6xl px-10 py-12">
      <div className="space-y-6">
        <TeamSummary />

        <div className={grid}>
          <div className="space-y-4">
            <WorkloadRenderer />
            <DepartmentRenderer />
          </div>
          <div className="space-y-4">
            <MemberRenderer />
            <AttentionRenderer />
            <RecommendationRenderer />
          </div>
        </div>
      </div>
    </div>
  );
}

