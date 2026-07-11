import BuilderProposalClient from "@/components/builder/BuilderProposalScreens";

export default async function BuilderProposalPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <BuilderProposalClient sessionId={sessionId} />;
}
