import CommunicationContextProvider from "./CommunicationContext";
import CommunicationLayout from "./CommunicationLayout";
import CommunicationErrorBoundary from "./CommunicationErrorBoundary";

export default function CommunicationRenderer({ viewModel }: { viewModel: any }) {
  return (
    <CommunicationErrorBoundary>
      <CommunicationContextProvider viewModel={viewModel}>
        <div className="min-h-screen w-full bg-background text-foreground">
          <div className="px-4 py-6">
            <div className="text-2xl font-semibold">Communications</div>
            <div className="mt-4">
              <CommunicationLayout />
            </div>
          </div>
        </div>
      </CommunicationContextProvider>
    </CommunicationErrorBoundary>
  );
}

