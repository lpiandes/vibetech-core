"use client";

import type { ReactNode } from "react";
import { createContext } from "react";

export type KnowledgeViewModel = any;

export const KnowledgeViewModelContext = createContext<KnowledgeViewModel | null>(null);

export default function KnowledgeContextProvider({ viewModel, children }: { viewModel: KnowledgeViewModel; children: ReactNode }) {
  return <KnowledgeViewModelContext.Provider value={viewModel}>{children}</KnowledgeViewModelContext.Provider>;
}

