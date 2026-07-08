"use client";

import type { ReactNode } from "react";
import { createContext } from "react";

export type KnowledgeHealthLevel = "excellent" | "good" | "warning" | "critical";

export type KnowledgeViewModel = {
  // Module metadata (from workspace KnowledgeViewBuilder).
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  badges: Array<{ id: string; label: string }>;
  actions: Array<{ id: string; label: string; type: string; href: string }>;
  displayOrder: number;
  visibility: string;
  status: string;
  categories: Array<{ id: string; name: string; description: string; updatedAt?: string; status?: string }>;

  // Legacy/compat metadata (not required by the executive cockpit).
  metadata?: { layout?: string; [key: string]: any };

  // Executive cockpit fields (from Knowledge readiness intelligence).
  summary: string;
  health: { score: number; level: KnowledgeHealthLevel };
  coverage: {
    totalCategories: number;
    activeCategories: number;
    categoriesWithoutActiveKnowledge: number;
    totalActiveKnowledgeItems: number;
    activeItemCoveragePercent: number;
  };
  metrics: {
    totalCategories: number;
    activeCategories: number;
    categoriesWithoutActiveKnowledge: number;
    totalActiveKnowledgeItems: number;
    totalArchivedKnowledgeItems: number;
    totalKnowledgeItems: number;
    attentionAreaCount: number;
    staleCategoryCount: number;
    lowConfidenceActiveItemCount: number;
    lowConfidenceActiveRatio: number;
    gapCount: number;
    riskCount: number;
    recommendationCount: number;
    healthScore: number;
    healthLevel: KnowledgeHealthLevel;
    activeItemCoveragePercent?: number;
  };
  areas: Array<{
    categoryId: string;
    category: string;
    healthLevel: KnowledgeHealthLevel;
    activeItemCount: number;
    archivedItemCount: number;
    latestUpdateAt: string | null;
    freshnessLabel: string;
    attentionRequired: boolean;
  }>;
  gaps: Array<{
    id: string;
    gap: string;
    priority: number;
    businessImpact: string;
    affectedArea: string;
    recommendedResponse: string;
  }>;
  risks: Array<{
    id: string;
    category: string;
    message: string;
    importance: "low" | "medium" | "high";
  }>;
  strengths: Array<{
    id: string;
    title: string;
    message: string;
  }>;
  recommendations: Array<{
    id: string;
    actionType: string;
    priority: number;
    recommendation: string;
  }>;
  nextFocusSubtitle: string;
};

export const KnowledgeViewModelContext = createContext<KnowledgeViewModel | null>(null);

export default function KnowledgeContextProvider({ viewModel, children }: { viewModel: KnowledgeViewModel; children: ReactNode }) {
  return <KnowledgeViewModelContext.Provider value={viewModel}>{children}</KnowledgeViewModelContext.Provider>;
}

