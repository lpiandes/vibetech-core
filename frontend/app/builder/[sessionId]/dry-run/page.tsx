import { BuilderDryRunClient } from "@/components/builder/BuilderInstallFlow";

export default async function BuilderDryRunPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <BuilderDryRunClient sessionId={sessionId} />;
}
