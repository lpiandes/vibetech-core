"use client";

import type { ReactNode } from "react";
import { createContext } from "react";

export type AnalyticsViewModel = any;

export const AnalyticsViewModelContext = createContext<AnalyticsViewModel | null>(null);

export default function AnalyticsContextProvider({
  viewModel,
  children,
}: {
  viewModel: AnalyticsViewModel;
  children: ReactNode;
}) {
  return <AnalyticsViewModelContext.Provider value={viewModel}>{children}</AnalyticsViewModelContext.Provider>;
}

