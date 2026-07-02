"use client";

import { useContext } from "react";
import { KnowledgeViewModelContext } from "./KnowledgeContext";
import SearchInput from "@/components/design-system/SearchInput";

export default function KnowledgeSearchRenderer() {
  const viewModel = useContext<any | null>(KnowledgeViewModelContext);
  if (!viewModel) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 text-sm font-semibold">Search</div>
      <SearchInput placeholder="Search knowledge" disabled />
    </div>
  );
}

