import InfoCard from "@/components/design-system/InfoCard";

export type CommunicationTimelineEntry = {
  timestampISO: string;
  status: string;
  action: string;
  object?: string;
};

export type CommunicationModel = {
  communicationId: string;
  channel: string;
  status: string;
  recipient: string;
  subject: string;
  body: string;
  createdAt: string;
  reviewRequired: boolean;
  timeline: CommunicationTimelineEntry[];
};

function formatCompactPreview(body: string, maxChars = 420) {
  const text = String(body ?? "").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trimEnd()}…`;
}

export default function CommunicationCard({
  communication,
}: {
  communication: CommunicationModel;
}) {
  const preview = formatCompactPreview(communication.body);

  return (
    <section className="rounded-3xl border border-border bg-background p-6 shadow-sm">
      <div className="text-sm font-semibold text-foreground">Communication</div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Channel
          </div>
          <div className="text-sm font-semibold text-foreground">
            {communication.channel}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Status
          </div>
          <div className="text-sm font-semibold text-foreground">
            {communication.status}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Recipient
          </div>
          <div className="text-sm font-semibold text-foreground">
            {communication.recipient}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Review Required
          </div>
          <div className="text-sm font-semibold text-foreground">
            {communication.reviewRequired ? "Yes" : "No"}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Subject
        </div>
        <div className="text-sm font-semibold text-foreground">
          {communication.subject}
        </div>

        <div className="rounded-2xl border border-border bg-background p-6">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Preview
          </div>
          <div className="mt-4 whitespace-pre-wrap break-words font-sans text-sm leading-7 text-foreground">
            {preview}
          </div>
        </div>
      </div>
    </section>
  );
}

