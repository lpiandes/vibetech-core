"use client";

import AnalyticsErrorBoundary from "@/components/analytics/AnalyticsErrorBoundary";

export default function AnalyticsErrorRoute({ error }: { error: any }) {
  return (
    <AnalyticsErrorBoundary>
      <div>{String(error?.message ?? error ?? "Analytics failed to render.")}</div>
    </AnalyticsErrorBoundary>
  );
}

