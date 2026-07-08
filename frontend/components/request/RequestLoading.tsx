"use client";

import { spacing } from "@/design/tokens";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveLoadingCard from "@/components/executive/ExecutiveLoadingCard";

export default function RequestLoading() {
  return (
    <div style={{ padding: spacing.xl }}>
      <ExecutiveStack gap="xl">
        <ExecutiveLoadingCard label="Preparing opportunity cockpit..." />
        <ExecutiveLoadingCard label="Calibrating pipeline health..." />
        <ExecutiveLoadingCard label="Rendering priority opportunities..." />
        <ExecutiveLoadingCard label="Finalizing recommendations..." />
      </ExecutiveStack>
    </div>
  );
}

