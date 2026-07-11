import { BuilderInstallClient } from "@/components/builder/BuilderProposalScreens";

export default async function BuilderInstallPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <BuilderInstallClient sessionId={sessionId} />;
}
