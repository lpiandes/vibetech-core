import { ArchitectInstallClient } from "@/components/architect/ArchitectInstallExperience";

export default async function ArchitectInstallPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <ArchitectInstallClient sessionId={sessionId} />;
}
