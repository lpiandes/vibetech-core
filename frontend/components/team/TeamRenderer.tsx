import TeamContextProvider from "./TeamContext";
import TeamExecutiveLayout from "./TeamExecutiveLayout";
import type { TeamViewModel } from "./TeamContext";

export default function TeamRenderer({ viewModel }: { viewModel: TeamViewModel }) {
  return (
    <TeamContextProvider viewModel={viewModel}>
      <TeamExecutiveLayout />
    </TeamContextProvider>
  );
}

