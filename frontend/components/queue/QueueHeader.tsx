import PageTitle from "@/components/design-system/PageTitle";

export default function QueueHeader() {
  return (
    <div className="mb-8">
      <PageTitle
        eyebrow="Buyer inquiries"
        title="Why is this waiting for your review?"
        description="Draft responses are held here until you confirm what the buyer should see next."
      />
    </div>
  );
}

