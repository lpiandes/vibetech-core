import InfoCard from "@/components/design-system/InfoCard";

export type CommunicationTimelineEntry = {
  timestampISO: string;
  status: string;
  action: string;
  object?: string;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CommunicationTimeline({
  timeline,
}: {
  timeline: CommunicationTimelineEntry[];
}) {
  const ordered = [...timeline].sort(
    (a, b) => new Date(a.timestampISO).getTime() - new Date(b.timestampISO).getTime(),
  );

  return (
    <section>
      <InfoCard title="Timeline">
        {ordered.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No communication timeline yet.
          </div>
        ) : (
          <div className="space-y-3">
            {ordered.map((t, idx) => (
              <div
                key={`${t.timestampISO}-${idx}`}
                className="grid grid-cols-4 items-start gap-x-6 gap-y-1"
              >
                <div className="w-16 shrink-0 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  {formatTime(t.timestampISO)}
                </div>
                <div className="col-span-1 text-sm font-semibold text-foreground">
                  {t.status}
                </div>
                <div className="col-span-2 text-sm leading-6 text-muted-foreground">
                  {t.action}
                  {t.object ? ` · ${t.object}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </InfoCard>
    </section>
  );
}

