import type { ReactNode } from "react";

import TeamContextProvider from "./TeamContext";
import TeamLayout from "./TeamLayout";
import type { TeamViewModel } from "./TeamContext";

export default function TeamRenderer({ viewModel }: { viewModel: TeamViewModel }) {
  return (
    <TeamContextProvider viewModel={viewModel}>
      <div className="min-h-screen w-full bg-background text-foreground">
        <TeamLayout />
      </div>
    </TeamContextProvider>
  );
}

