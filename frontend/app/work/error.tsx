"use client";

import WorkErrorBoundary from "@/components/work/WorkErrorBoundary";

export default function WorkErrorRoute({ error }: { error: any }) {
  return (
    <WorkErrorBoundary>
      <div>{String(error?.message ?? error ?? "Work failed to render.")}</div>
    </WorkErrorBoundary>
  );
}

