"use client";

import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveLoadingCard from "@/components/executive/ExecutiveLoadingCard";
import { spacing } from "@/design/tokens";

export default function CapabilityLoading() {
  return (
    <div style={{ width: "100%", minHeight: "100vh", padding: spacing.xl }}>
      <ExecutiveStack gap="xl">
        <ExecutiveLoadingCard label="Preparing capabilities cockpit..." />
        <ExecutiveLoadingCard label="Calibrating capability readiness..." />
        <ExecutiveLoadingCard label="Rendering strategy execution priorities..." />
      </ExecutiveStack>
    </div>
  );
}

