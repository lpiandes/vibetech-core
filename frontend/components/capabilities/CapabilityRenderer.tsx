import CapabilityContextProvider from "./CapabilityContext";
import CapabilitiesExecutiveLayout from "./CapabilitiesExecutiveLayout";

export default function CapabilityRenderer({ viewModel }: { viewModel: any }) {
  return (
    <CapabilityContextProvider viewModel={viewModel}>
      <CapabilitiesExecutiveLayout />
    </CapabilityContextProvider>
  );
}

