import { redirect } from "next/navigation";

/** For You → Needs Attention (canonical intelligence surface). */
export default async function ForYouPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  redirect(`/b/${encodeURIComponent(businessId)}/intelligence`);
}
