import PrimaryButton from "@/components/design-system/PrimaryButton";
import SecondaryButton from "@/components/design-system/SecondaryButton";
import InfoCard from "@/components/design-system/InfoCard";

export default function QuickActions() {
  return (
    <section>
      <InfoCard title="Quick Actions">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div>
            <PrimaryButton type="button" className="h-11 rounded-2xl px-6">
              Review Work
            </PrimaryButton>
          </div>

          <div className="flex items-center gap-3">
            <SecondaryButton
              type="button"
              className="h-11 rounded-2xl px-6"
            >
              View Team
            </SecondaryButton>
            <SecondaryButton
              type="button"
              className="h-11 rounded-2xl px-6"
            >
              Performance
            </SecondaryButton>
          </div>
        </div>
      </InfoCard>
    </section>
  );
}

