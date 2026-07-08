import CommunicationContextProvider from "./CommunicationContext";
import CommunicationErrorBoundary from "./CommunicationErrorBoundary";
import CommunicationExecutiveLayout from "./CommunicationExecutiveLayout";

export default function CommunicationRenderer({ viewModel }: { viewModel: any }) {
  return (
    <CommunicationErrorBoundary>
      <CommunicationContextProvider viewModel={viewModel}>
        <CommunicationExecutiveLayout />
      </CommunicationContextProvider>
    </CommunicationErrorBoundary>
  );
}

