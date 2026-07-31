import { ArchitectInstallClient } from "@/components/architect/ArchitectInstallExperience";

export default async function ArchitectInstallPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ launch?: string }>;
}) {
  const { sessionId } = await params;
  const query = await searchParams;
  const autoLaunch = String(query?.launch ?? "") === "1";
  return <ArchitectInstallClient sessionId={sessionId} autoLaunch={autoLaunch} />;
}
