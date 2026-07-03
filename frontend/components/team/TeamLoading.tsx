"use client";

import { spacing } from "@/design/tokens";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveLoadingCard from "@/components/executive/ExecutiveLoadingCard";

export default function TeamLoading() {
  return (
    <div style={{ padding: spacing.xl }}>
      <ExecutiveStack gap="xl">
        <ExecutiveLoadingCard label="Preparing workforce cockpit..." />
        <ExecutiveLoadingCard label="Calibrating workforce pulse..." />
        <ExecutiveLoadingCard label="Rendering departments and people..." />
        <ExecutiveLoadingCard label="Preparing attention and recommendations..." />
      </ExecutiveStack>
    </div>
  );
}

