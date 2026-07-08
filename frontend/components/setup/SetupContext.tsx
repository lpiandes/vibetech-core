"use client";

import { createContext, useContext, type ReactNode } from "react";

export type SetupViewModel = any;

export const SetupViewModelContext = createContext<SetupViewModel | null>(null);

export function useSetupViewModel() {
  const ctx = useContext(SetupViewModelContext);
  if (!ctx) throw new Error("SetupViewModelContext missing");
  return ctx;
}

export default function SetupContextProvider({ viewModel, children }: { viewModel: SetupViewModel; children: ReactNode }) {
  return <SetupViewModelContext.Provider value={viewModel}>{children}</SetupViewModelContext.Provider>;
}
