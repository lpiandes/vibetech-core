import { redirect } from "next/navigation";

export default async function BuilderProposalPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  redirect(`/builder/${sessionId}`);
}
