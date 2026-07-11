import { ArchitectDryRunClient } from "@/components/architect/ArchitectInstallExperience";

export default async function ArchitectDryRunPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <ArchitectDryRunClient sessionId={sessionId} />;
}
