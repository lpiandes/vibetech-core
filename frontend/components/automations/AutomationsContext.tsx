"use client";

import { createContext, useContext, type ReactNode } from "react";

export const AutomationsViewModelContext = createContext<any>(null);

export function useAutomationsViewModel() {
  const ctx = useContext(AutomationsViewModelContext);
  if (!ctx) throw new Error("AutomationsViewModelContext missing");
  return ctx;
}

export default function AutomationsContextProvider({ viewModel, children }: { viewModel: any; children: ReactNode }) {
  return <AutomationsViewModelContext.Provider value={viewModel}>{children}</AutomationsViewModelContext.Provider>;
}
