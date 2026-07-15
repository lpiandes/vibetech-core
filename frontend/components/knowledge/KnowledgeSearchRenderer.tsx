"use client";

import { useContext } from "react";
import { KnowledgeViewModelContext } from "./KnowledgeContext";

/**
 * Search lives on the executive Knowledge layout (live filter).
 * Kept as a no-op stub so package viewModel slots remain compatible.
 */
export default function KnowledgeSearchRenderer() {
  const viewModel = useContext<any | null>(KnowledgeViewModelContext);
  if (!viewModel) return null;
  return null;
}
