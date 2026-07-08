import { getWorkspaceService } from "@/lib/workspace/getWorkspaceService";
import CapabilityRenderer from "@/components/capabilities/CapabilityRenderer";

export default function CapabilitiesPage() {
  const service = getWorkspaceService();
  const viewModel = service.loadCapabilityViewModel();
  return <CapabilityRenderer viewModel={viewModel} />;
}

