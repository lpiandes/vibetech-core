import ArchitectWorkspace from "@/components/architect/ArchitectWorkspace";

export default async function ArchitectSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <ArchitectWorkspace sessionId={sessionId} />;
}
