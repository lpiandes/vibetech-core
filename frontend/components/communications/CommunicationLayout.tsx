import CommunicationSummary from "./CommunicationSummary";
import CommunicationQueueRenderer from "./CommunicationQueueRenderer";
import CommunicationThreadRenderer from "./CommunicationThreadRenderer";
import CommunicationMessageRenderer from "./CommunicationMessageRenderer";
import CommunicationAttentionRenderer from "./CommunicationAttentionRenderer";
import CommunicationRecommendationRenderer from "./CommunicationRecommendationRenderer";

export default function CommunicationLayout() {
  return (
    <div className="space-y-4">
      <CommunicationSummary />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CommunicationQueueRenderer />
        <CommunicationAttentionRenderer />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CommunicationThreadRenderer />
        <CommunicationMessageRenderer />
      </div>
      <CommunicationRecommendationRenderer />
    </div>
  );
}

