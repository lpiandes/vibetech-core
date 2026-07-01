import ReviewWorkspace from "@/components/review/ReviewWorkspace";

export default async function ReviewWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  return <ReviewWorkspace workItemId={resolvedParams.id} />;
}

