import AutomationsContextProvider from "./AutomationsContext";
import AutomationsExecutiveLayout from "./AutomationsExecutiveLayout";
import AutomationsErrorBoundary from "./AutomationsErrorBoundary";

export default function AutomationsRenderer({ viewModel }: { viewModel: any }) {
  return (
    <AutomationsErrorBoundary>
      <AutomationsContextProvider viewModel={viewModel}>
        <div className="min-h-screen w-full bg-background text-foreground">
          <AutomationsExecutiveLayout />
        </div>
      </AutomationsContextProvider>
    </AutomationsErrorBoundary>
  );
}
