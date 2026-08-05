import { getAuthorizedBusinessScope } from "@/lib/platform/AuthorizedWorkspaceService";
import McBrideReadinessLayout from "@/components/readiness/McBrideReadinessLayout";

export default async function ReadinessPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  await getAuthorizedBusinessScope(businessId);
  return <McBrideReadinessLayout businessId={businessId} />;
}
