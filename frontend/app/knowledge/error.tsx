"use client";

import KnowledgeErrorBoundary from "@/components/knowledge/KnowledgeErrorBoundary";

export default function KnowledgeErrorRoute({ error }: { error: any }) {
  return (
    <KnowledgeErrorBoundary>
      <div>{String(error?.message ?? error ?? "Knowledge failed to render.")}</div>
    </KnowledgeErrorBoundary>
  );
}

