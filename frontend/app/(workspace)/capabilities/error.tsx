"use client";

import CapabilityErrorBoundary from "@/components/capabilities/CapabilityErrorBoundary";

export default function CapabilitiesErrorRoute({ error }: { error: any }) {
  return (
    <CapabilityErrorBoundary>
      <div>{String(error?.message ?? error ?? "Capabilities failed to render.")}</div>
    </CapabilityErrorBoundary>
  );
}

