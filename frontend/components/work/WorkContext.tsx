"use client";

import type { ReactNode } from "react";
import { createContext } from "react";

export type WorkViewModel = any;

export const WorkViewModelContext = createContext<WorkViewModel | null>(null);

export default function WorkContextProvider({ viewModel, children }: { viewModel: WorkViewModel; children: ReactNode }) {
  return <WorkViewModelContext.Provider value={viewModel}>{children}</WorkViewModelContext.Provider>;
}

