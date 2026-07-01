import InfoCard from "@/components/design-system/InfoCard";

export type CommunicationTimelineEntry = {
  timestampISO: string;
  status: string;
  action: string;
  object?: string;
};

export default function CommunicationTimeline({
  timeline,
}: {
  timeline: CommunicationTimelineEntry[];
}) {
  const reached = new Set((timeline ?? []).map((t) => t.status));

  const steps: Array<{ status: string; label: string }> = [
    { status: "DRAFT", label: "Draft Created" },
    { status: "PENDING_APPROVAL", label: "Awaiting Review" },
    { status: "APPROVED", label: "Approved" },
    { status: "SENT", label: "Sent" },
    { status: "DELIVERED", label: "Delivered" },
    { status: "OPENED", label: "Opened" },
    { status: "REPLIED", label: "Replied" },
  ];

  return (
    <section>
      <InfoCard title="Communication Progress">
        <div className="relative pl-6">
          <div className="absolute left-0 top-2 bottom-2 w-px bg-border" />

          <div className="space-y-6">
            {steps.map((s) => {
              const done = reached.has(s.status);
              return (
                <div key={s.status} className="flex items-start gap-4">
                  <div
                    className={[
                      "mt-0.5 h-3 w-3 rounded-full",
                      done ? "bg-primary" : "bg-border",
                    ].join(" ")}
                  />

                  <div className="min-w-0">
                    <div
                      className={[
                        "text-sm font-semibold",
                        done ? "text-foreground" : "text-muted-foreground",
                      ].join(" ")}
                    >
                      {s.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </InfoCard>
    </section>
  );
}

