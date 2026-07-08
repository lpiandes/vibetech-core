import AnalyticsContextProvider from "./AnalyticsContext";
import AnalyticsExecutiveLayout from "./AnalyticsExecutiveLayout";
import AnalyticsErrorBoundary from "./AnalyticsErrorBoundary";

export default function AnalyticsRenderer({ viewModel }: { viewModel: any }) {
  return (
    <AnalyticsErrorBoundary>
      <AnalyticsContextProvider viewModel={viewModel}>
        <AnalyticsExecutiveLayout />
      </AnalyticsContextProvider>
    </AnalyticsErrorBoundary>
  );
}

