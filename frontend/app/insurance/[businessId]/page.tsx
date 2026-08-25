"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { feSendReasonLabel } from "../../../../backend/core/fe-retention/FeRetentionLabels.js";
import { FeStatusBadge } from "@/components/insurance/FeStatusBadge";

type Attention = {
  cards: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    clientId: string;
    clientName: string;
    status?: string;
    noticeId?: string;
  }>;
  recentSends: Array<{
    id: string;
    at: string;
    kind: string;
    channel?: string;
    clientName?: string;
    to?: string | null;
    body?: string | null;
    ok: boolean;
    error?: string | null;
  }>;
  clientCount: number;
  atRiskCount: number;
  holiday: { month: number; day: number; activeWindow: boolean };
  sendHourNote?: string;
};

export default function InsuranceTodayPage() {
  const params = useParams();
  const businessId = String(params.businessId ?? "");
  const [attention, setAttention] = useState<Attention | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/insurance/${encodeURIComponent(businessId)}/attention`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not load dashboard.");
        if (!cancelled) setAttention(data.attention);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (error) {
    return <div className="fe-card"><p>{error}</p></div>;
  }
  if (!attention) {
    return <div className="fe-card"><p className="fe-muted">Loading your book…</p></div>;
  }

  return (
    <>
      <div className="fe-grid-2" style={{ marginBottom: "1rem" }}>
        <div className="fe-card">
          <p className="fe-muted">Clients</p>
          <h2 style={{ fontSize: "2rem", margin: 0 }}>{attention.clientCount}</h2>
        </div>
        <div className="fe-card">
          <p className="fe-muted">At risk (missed / lapsed)</p>
          <h2 style={{ fontSize: "2rem", margin: 0 }}>{attention.atRiskCount}</h2>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", gap: "0.75rem", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: "1.35rem" }}>Needs attention</h2>
        <Link href={`/insurance/${businessId}/clients?new=1`} className="fe-btn" style={{ textDecoration: "none", display: "inline-block" }}>
          Add client
        </Link>
      </div>

      {!attention.cards.length ? (
        <div className="fe-card">
          <h3>All clear</h3>
          <p className="fe-muted" style={{ margin: 0 }}>
            Shows missed/lapsed policies, YES reinstatement replies, unmatched carrier emails, SMS opt-outs, birthdays in the next 7 days, and upcoming payment reminders. Scheduled texts go out with the daily 1:00 PM UTC job.
          </p>
        </div>
      ) : (
        attention.cards.map((card) => (
          <div key={card.id} className="fe-card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
              <div>
                <FeStatusBadge status={card.status || card.type} label={card.type.replace("_", " ")} />
                <h3 style={{ marginTop: "0.5rem" }}>{card.title}</h3>
                <p className="fe-muted" style={{ margin: 0 }}>{card.body}</p>
              </div>
              {card.noticeId ? (
                <button
                  type="button"
                  className="fe-btn secondary"
                  onClick={async () => {
                    const res = await fetch(`/api/insurance/${encodeURIComponent(businessId)}/attention`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ dismissNoticeId: card.noticeId }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok && data.attention) setAttention(data.attention);
                  }}
                >
                  Dismiss
                </button>
              ) : card.clientId ? (
                <Link
                  href={`/insurance/${businessId}/clients/${card.clientId}`}
                  className="fe-btn secondary"
                  style={{ textDecoration: "none", alignSelf: "flex-start" }}
                >
                  Open
                </Link>
              ) : null}
            </div>
          </div>
        ))
      )}

      {attention.holiday?.activeWindow ? (
        <div className="fe-card">
          <h3>Holiday messages</h3>
          <p className="fe-muted" style={{ margin: 0 }}>
            Holiday window is active — greeting texts send with the daily 1:00 PM UTC job on the configured date.
          </p>
        </div>
      ) : null}

      <h2 style={{ margin: "1.5rem 0 0.75rem", fontSize: "1.2rem" }}>Recent auto-sends</h2>
      <div className="fe-card">
        {!attention.recentSends?.length ? (
          <p className="fe-muted" style={{ margin: 0 }}>No messages yet.</p>
        ) : (
          <table className="fe-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>To</th>
                <th>Reason</th>
                <th>Message</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attention.recentSends.slice(0, 20).map((row) => (
                <tr key={row.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {row.at ? new Date(row.at).toLocaleString() : "—"}
                  </td>
                  <td>
                    <div>{row.clientName || "—"}</div>
                    {row.to ? <div className="fe-muted">{row.to}</div> : null}
                  </td>
                  <td>{feSendReasonLabel(row.kind)}</td>
                  <td style={{ maxWidth: 280 }}>
                    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {row.body || row.error || "—"}
                    </div>
                  </td>
                  <td>{row.ok ? "Sent" : "Failed"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
