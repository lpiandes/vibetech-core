import AnalyticsContextProvider from "./AnalyticsContext";
import AnalyticsLayout from "./AnalyticsLayout";
import AnalyticsErrorBoundary from "./AnalyticsErrorBoundary";

export default function AnalyticsRenderer({ viewModel }: { viewModel: any }) {
  return (
    <AnalyticsErrorBoundary>
      <AnalyticsContextProvider viewModel={viewModel}>
        <div className="min-h-screen w-full bg-background text-foreground">
          <div className="px-4 py-6">
            <div className="text-2xl font-semibold">Analytics</div>
            <div className="mt-4">
              <AnalyticsLayout />
            </div>
          </div>
        </div>
      </AnalyticsContextProvider>
    </AnalyticsErrorBoundary>
  );
}

