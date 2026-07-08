"use client";

import CommunicationErrorBoundary from "@/components/communications/CommunicationErrorBoundary";

export default function CommunicationsErrorRoute({ error }: { error: any }) {
  return (
    <CommunicationErrorBoundary>
      <div>{String(error?.message ?? error ?? "Communications failed to render.")}</div>
    </CommunicationErrorBoundary>
  );
}

