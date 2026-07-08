import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";
import EmptyBusinessHome from "@/components/home/EmptyBusinessHome";

export default async function BusinessHomePage() {
  const service = getWorkspaceService();
  const home = service.loadBusinessHomeViewModel();
  return <EmptyBusinessHome {...home} />;
}
