"use client";

import TeamErrorBoundary from "@/components/team/TeamErrorBoundary";

export default function TeamErrorRoute({ error }: { error: any }) {
  return (
    <TeamErrorBoundary>
      <div>{String(error?.message ?? error ?? "Team failed to render.")}</div>
    </TeamErrorBoundary>
  );
}

