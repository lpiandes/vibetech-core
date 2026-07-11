import { redirect } from "next/navigation";

export default async function BuilderDryRunRedirect({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  redirect(`/architect/${sessionId}/dry-run`);
}
