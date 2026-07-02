import { WorkspaceService } from "@/lib/workspace/WorkspaceService";
import CapabilityRenderer from "@/components/capabilities/CapabilityRenderer";

export default function CapabilitiesPage() {
  const service = new WorkspaceService();
  const viewModel = service.loadCapabilityViewModel();
  return <CapabilityRenderer viewModel={viewModel} />;
}

