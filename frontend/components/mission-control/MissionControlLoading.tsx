"use client";

import { spacing } from "@/design/tokens";
import ExecutiveStack from "@/components/executive/ExecutiveStack";
import ExecutiveLoadingCard from "@/components/executive/ExecutiveLoadingCard";

export default function MissionControlLoading() {
  return (
    <div style={{ padding: spacing.xl, transition: "opacity 200ms ease", opacity: 0.9 }}>
      <ExecutiveStack gap="xl">
        <ExecutiveLoadingCard label="Preparing Mission Control cockpit..." />
        <ExecutiveLoadingCard label="Calibrating business pulse..." />
        <ExecutiveLoadingCard label="Rendering executive priorities..." />
      </ExecutiveStack>
    </div>
  );
}

