// Client component: handles Approve/Reject/Send interactions via lightweight API routes.
"use client";

import { useRouter } from "next/navigation";
import ApprovalStatusCard from "./ApprovalStatusCard";

export default function ActionBar({
  workItemId,
  approval,
  communicationStatus,
}: {
  workItemId: string;
  approval: {
    requiresApproval: boolean;
    statusLabel: string;
  };
  communicationStatus: string;
}) {
  const router = useRouter();

  async function postDecision(decision: "APPROVE" | "REJECT") {
    await fetch(`/api/work-queue/${encodeURIComponent(workItemId)}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    router.refresh();
  }

  async function postSend() {
    await fetch(`/api/work-queue/${encodeURIComponent(workItemId)}/send`, {
      method: "POST",
    });
    router.refresh();
  }

  return (
    <section className="rounded-3xl border border-border bg-background p-6 shadow-sm">
      <div className="text-sm font-semibold text-foreground">Actions</div>

      <div className="mt-5">
        <ApprovalStatusCard approval={approval} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          className="h-11 w-full rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => postDecision("APPROVE")}
        >
          Approve
        </button>

        <button
          type="button"
          className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Edit
        </button>

        <button
          type="button"
          className="h-11 w-full rounded-2xl border border-destructive/30 bg-destructive/10 px-4 text-sm font-semibold text-destructive shadow-sm transition hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/20"
          onClick={() => postDecision("REJECT")}
        >
          Reject
        </button>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        Approving finalizes this prepared communication for delivery.
      </div>

      {communicationStatus === "APPROVED" ? (
        <div className="mt-4">
          <button
            type="button"
            className="h-11 w-full rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => postSend()}
          >
            Send
          </button>
          <div className="mt-3 text-xs text-muted-foreground">
            Sending executes delivery using your configured communication provider.
          </div>
        </div>
      ) : null}
    </section>
  );
}

