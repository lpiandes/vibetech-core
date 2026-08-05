import { redirect } from "next/navigation";

/** Alias → Decisions (intelligence). */
export default async function DecisionsAliasPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/b/${encodeURIComponent(businessId)}/intelligence`);
}
