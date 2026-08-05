import { redirect } from "next/navigation";

/** Alias → Company Rules (knowledge). */
export default async function CompanyRulesAliasPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/b/${encodeURIComponent(businessId)}/knowledge`);
}
