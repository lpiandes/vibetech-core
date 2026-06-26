import PageTitle from "@/components/design-system/PageTitle";

export default function QueueHeader() {
  return (
    <div className="mb-8">
      <PageTitle
        eyebrow="Work Queue"
        title="My Digital Employee needs my review."
        description="Review completed work coming from your Digital Workforce. Approve when appropriate, and move forward confidently."
      />
    </div>
  );
}

