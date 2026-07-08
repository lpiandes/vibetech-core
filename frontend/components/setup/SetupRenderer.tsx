import SetupContextProvider from "./SetupContext";
import SetupExecutiveLayout from "./SetupExecutiveLayout";
import SetupErrorBoundary from "./SetupErrorBoundary";

export default function SetupRenderer({ viewModel }: { viewModel: any }) {
  return (
    <SetupErrorBoundary>
      <SetupContextProvider viewModel={viewModel}>
        <div className="min-h-screen w-full bg-background text-foreground">
          <SetupExecutiveLayout />
        </div>
      </SetupContextProvider>
    </SetupErrorBoundary>
  );
}
