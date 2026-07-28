import { redirect } from "next/navigation";

/** Performance was folded into Home — keep URL from orphaning users. */
export default async function PerformancePage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/b/${encodeURIComponent(businessId)}/home`);
}
