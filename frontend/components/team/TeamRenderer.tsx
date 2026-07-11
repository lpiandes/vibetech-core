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
  organization = null,
}: {
  viewModel: TeamViewModel;
  platformTeam?: PlatformTeamData;
  organization?: any;
}) {
  return (
    <TeamContextProvider viewModel={viewModel}>
      <TeamExecutiveLayout platformTeam={platformTeam} organization={organization} />
    </TeamContextProvider>
  );
}
