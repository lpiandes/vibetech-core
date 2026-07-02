import CapabilitySummary from "./CapabilitySummary";
import CapabilityCategoryRenderer from "./CapabilityCategoryRenderer";
import CapabilityProviderRenderer from "./CapabilityProviderRenderer";
import CapabilityGapRenderer from "./CapabilityGapRenderer";
import CapabilityRiskRenderer from "./CapabilityRiskRenderer";
import CapabilityRecommendationRenderer from "./CapabilityRecommendationRenderer";

export default function CapabilityLayout() {
  return (
    <div className="space-y-4">
      <CapabilitySummary />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CapabilityCategoryRenderer />
        <CapabilityProviderRenderer />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CapabilityGapRenderer />
        <CapabilityRiskRenderer />
      </div>
      <CapabilityRecommendationRenderer />
    </div>
  );
}

