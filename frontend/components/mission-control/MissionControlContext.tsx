"use client";

import type { ReactNode } from "react";
import { createContext } from "react";

export type MissionControlViewModel = any;

export const MissionControlViewModelContext = createContext<MissionControlViewModel | null>(null);

export default function MissionControlContextProvider({
  viewModel,
  children,
}: {
  viewModel: MissionControlViewModel;
  children: ReactNode;
}) {
  return <MissionControlViewModelContext.Provider value={viewModel}>{children}</MissionControlViewModelContext.Provider>;
}

