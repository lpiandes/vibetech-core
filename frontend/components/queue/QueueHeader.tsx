import PageTitle from "@/components/design-system/PageTitle";

export default function QueueHeader() {
  return (
    <div className="mb-8">
      <PageTitle
        eyebrow="Work Queue"
        title="Why is this waiting for me?"
        description="These items are holding steady until you review them and guide the next move."
      />
    </div>
  );
}

