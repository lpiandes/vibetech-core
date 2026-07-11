import BuilderWorkspace from "@/components/builder/BuilderWorkspace";

export default async function BuilderSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <BuilderWorkspace sessionId={sessionId} />;
}
