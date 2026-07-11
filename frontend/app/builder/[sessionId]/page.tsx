import { redirect } from "next/navigation";

export default async function BuilderSessionRedirect({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  redirect(`/architect/${sessionId}`);
}
