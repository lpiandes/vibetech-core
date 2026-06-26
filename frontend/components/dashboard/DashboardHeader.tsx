import InfoCard from "@/components/design-system/InfoCard";
import PrimaryButton from "@/components/design-system/PrimaryButton";

export default function DashboardHeader() {
  return (
    <section>
      <InfoCard title="Good morning, Leo.">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              What does my Digital Workforce need from me?
            </div>

            <p className="mt-3 text-sm leading-6 text-foreground">
              Your Digital Workforce completed 18 tasks while you were away.
            </p>

            <div className="mt-2 text-sm leading-6 text-foreground">
              <span className="font-medium">3 items</span> require your review.
            </div>

            <div className="mt-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Estimated review time
            </div>
            <div className="mt-2 text-sm leading-6 text-foreground">
              <span className="font-semibold">4 minutes</span>
            </div>
          </div>

          <div className="shrink-0 pt-1">
            <PrimaryButton type="button" className="h-11 rounded-2xl px-6">
              Review Work
            </PrimaryButton>
          </div>
        </div>
      </InfoCard>
    </section>
  );
}

