"use client";

import type { ReactNode } from "react";
import { createContext } from "react";

export type TeamViewModel = any;

export const TeamViewModelContext = createContext<TeamViewModel | null>(null);

export default function TeamContextProvider({ viewModel, children }: { viewModel: TeamViewModel; children: ReactNode }) {
  return <TeamViewModelContext.Provider value={viewModel}>{children}</TeamViewModelContext.Provider>;
}

