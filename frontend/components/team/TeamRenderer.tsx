import TeamContextProvider from "./TeamContext";
import TeamExecutiveLayout from "./TeamExecutiveLayout";
import type { TeamViewModel } from "./TeamContext";

export type PlatformTeamData = {
  members: { id: string; name: string; email: string; roleLabel: string }[];
  pending: { id: string; email: string; roleLabel: string; inviteUrl?: string | null }[];
  businessId: string;
  canInvite: boolean;
  canManage: boolean;
  showDevInviteLinks?: boolean;
};

export default function TeamRenderer({
  viewModel,
  platformTeam,
}: {
  viewModel: TeamViewModel;
  platformTeam?: PlatformTeamData;
}) {
  return (
    <TeamContextProvider viewModel={viewModel}>
      <TeamExecutiveLayout platformTeam={platformTeam} />
    </TeamContextProvider>
  );
}
