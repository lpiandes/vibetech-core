"use client";

import type { ReactNode } from "react";
import { createContext } from "react";

export type CapabilityViewModel = any;

export const CapabilityViewModelContext = createContext<CapabilityViewModel | null>(null);

export default function CapabilityContextProvider({
  viewModel,
  children,
}: {
  viewModel: CapabilityViewModel;
  children: ReactNode;
}) {
  return <CapabilityViewModelContext.Provider value={viewModel}>{children}</CapabilityViewModelContext.Provider>;
}

