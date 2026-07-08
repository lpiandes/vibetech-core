"use client";

import MissionControlErrorBoundary from "@/components/mission-control/MissionControlErrorBoundary";

export default function MissionControlErrorRoute({ error }: { error: any }) {
  return (
    <MissionControlErrorBoundary>
      <div>{String(error?.message ?? error ?? "Mission Control failed.")}</div>
    </MissionControlErrorBoundary>
  );
}

