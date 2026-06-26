import { Dot } from "lucide-react";

import InfoCard from "@/components/design-system/InfoCard";

const activity = [
  { time: "09:14", text: "Prepared update for John Smith" },
  { time: "08:51", text: "Escalated urgent hearing change" },
  { time: "08:20", text: "Drafted reassurance update" },
];

export default function RecentActivity() {
  return (
    <section>
      <InfoCard title="Recent Activity">
        <div className="space-y-3">
          {activity.map((a) => (
            <div key={a.time} className="flex items-start gap-4">
              <div className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
                {a.time}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Dot className="h-1.5 w-1.5 text-muted-foreground" aria-hidden="true" />
                  <div className="text-sm leading-6 text-foreground">
                    {a.text}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </InfoCard>
    </section>
  );
}

