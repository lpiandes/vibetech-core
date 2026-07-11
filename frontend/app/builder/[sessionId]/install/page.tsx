import { redirect } from "next/navigation";

export default async function BuilderInstallRedirect({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  redirect(`/architect/${sessionId}/install`);
}
