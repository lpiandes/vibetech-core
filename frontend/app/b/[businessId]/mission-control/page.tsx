import { redirect } from "next/navigation";

/** Mission Control → Operating Home (canonical). */
export default async function BusinessMissionControlPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/b/${encodeURIComponent(businessId)}/home`);
}
