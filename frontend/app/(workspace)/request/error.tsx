"use client";

import RequestErrorBoundary from "@/components/request/RequestErrorBoundary";

export default function RequestErrorRoute({ error }: { error: any }) {
  return (
    <RequestErrorBoundary>
      <div>{String(error?.message ?? error ?? "Request failed to render.")}</div>
    </RequestErrorBoundary>
  );
}

