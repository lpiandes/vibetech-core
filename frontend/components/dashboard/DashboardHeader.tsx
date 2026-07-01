import InfoCard from "@/components/design-system/InfoCard";
import PrimaryButton from "@/components/design-system/PrimaryButton";
import { demoCompany } from "@/lib/company/demoCompany";

export default function DashboardHeader() {
  const inquiries = demoCompany.companyData.inquiries;

  const inquiriesCount = inquiries.length;
  const draftsReadyForReview = inquiries.filter(
    (i) => i.status === "Needs Review" && i.draftResponseReady,
  );

  const avgResponseTimeMinutes = (() => {
    const times = draftsReadyForReview
      .map((i) => i.responseTimeMinutes)
      .filter((t): t is number => typeof t === "number");
    if (!times.length) return 0;
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  })();

  return (
    <section>
      <InfoCard title="Good morning, Leo.">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Buyer inquiries
            </div>

            <p className="mt-3 text-sm leading-6 text-foreground">
              Your Digital Workforce received {inquiriesCount} new buyer
              inquiries while you were away.
            </p>

            <div className="mt-2 text-sm leading-6 text-foreground">
              <span className="font-medium">
                {draftsReadyForReview.length} Draft responses
              </span>{" "}
              are ready for your review.
            </div>

            <div className="mt-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Estimated response time
            </div>
            <div className="mt-2 text-sm leading-6 text-foreground">
              <span className="font-semibold">
                {avgResponseTimeMinutes} minutes
              </span>
            </div>
          </div>

          <div className="shrink-0 pt-1">
            <PrimaryButton
              type="button"
              className="h-11 rounded-2xl px-6"
            >
              Review buyer response
            </PrimaryButton>
          </div>
        </div>
      </InfoCard>
    </section>
  );
}

