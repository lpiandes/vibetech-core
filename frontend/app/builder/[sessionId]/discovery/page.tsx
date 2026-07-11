import { BuilderDiscoveryClient } from "@/components/builder/BuilderScreens";

export default async function BuilderDiscoveryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <BuilderDiscoveryClient sessionId={sessionId} />;
}
