"use client";

import type { ReactNode } from "react";
import { createContext } from "react";

export type CommunicationViewModel = any;

export const CommunicationViewModelContext = createContext<CommunicationViewModel | null>(null);

export default function CommunicationContextProvider({
  viewModel,
  children,
}: {
  viewModel: CommunicationViewModel;
  children: ReactNode;
}) {
  return <CommunicationViewModelContext.Provider value={viewModel}>{children}</CommunicationViewModelContext.Provider>;
}

