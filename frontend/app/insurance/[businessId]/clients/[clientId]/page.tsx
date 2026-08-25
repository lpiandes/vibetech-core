"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  MONTH_OPTIONS,
  daysInMonth,
  feSendReasonLabel,
} from "../../../../../../backend/core/fe-retention/FeRetentionLabels.js";
import { FeStatusBadge } from "@/components/insurance/FeStatusBadge";

type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  birthday?: string | null;
  address?: string | null;
  holidayMonth?: number | null;
  holidayDay?: number | null;
  templateOverrides?: Record<string, string>;
  smsOptedOut?: boolean;
  reinstatementStatus?: string | null;
  policy?: {
    carrier?: string;
    policyNumber?: string;
    premium?: string;
    dueDay?: number;
    docsArriveDays?: number;
    effectiveDate?: string | null;
    status?: string;
    statusSource?: string | null;
  };
};

const STATUS_FEEDBACK: Record<string, string> = {
  missed: "Marked missed — recovery text sent.",
  lapsed: "Marked lapsed — recovery text sent.",
  active: "Marked reinstated.",
  cancelled: "Marked cancelled.",
};

function formatLogStatus(row: { ok?: boolean; error?: string | null; channel?: string }) {
  if (row.ok) return row.channel === "sms" ? "Sent to carrier" : "Sent";
  return row.error || "Failed";
}

const OVERRIDE_KEYS = [
  { key: "holiday", label: "Holiday text" },
  { key: "birthday", label: "Birthday text" },
  { key: "welcome", label: "Welcome text" },
  { key: "docsMail", label: "Policy papers text" },
  { key: "paymentReminder", label: "Payment reminder text" },
  { key: "lapseRecovery", label: "Missed / lapse text" },
] as const;

export default function InsuranceClientDetailPage() {
  const params = useParams();
  const businessId = String(params.businessId ?? "");
  const clientId = String(params.clientId ?? "");
  const [client, setClient] = useState<Client | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pressingStatus, setPressingStatus] = useState<string | null>(null);
  const [flashStatus, setFlashStatus] = useState<string | null>(null);
  const statusSectionRef = useRef<HTMLDivElement | null>(null);
  const [holidayMonth, setHolidayMonth] = useState<string>("");
  const [holidayDay, setHolidayDay] = useState<string>("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState({
    name: "",
    phone: "",
    email: "",
    birthday: "",
    address: "",
    carrier: "",
    policyNumber: "",
    premium: "",
    dueDay: "1",
    docsArriveDays: "10",
    effectiveDate: "",
  });

  async function load() {
    const res = await fetch(`/api/insurance/${encodeURIComponent(businessId)}/clients/${encodeURIComponent(clientId)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not load client.");
    setClient(data.client);
    setHistory(data.history ?? []);
    setHolidayMonth(data.client?.holidayMonth != null ? String(data.client.holidayMonth) : "");
    setHolidayDay(data.client?.holidayDay != null ? String(data.client.holidayDay) : "");
    setOverrides({ ...(data.client?.templateOverrides ?? {}) });
    setProfile({
      name: data.client?.name ?? "",
      phone: data.client?.phone ?? "",
      email: data.client?.email ?? "",
      birthday: String(data.client?.birthday ?? "").slice(0, 10),
      address: data.client?.address ?? "",
      carrier: data.client?.policy?.carrier ?? "",
      policyNumber: data.client?.policy?.policyNumber ?? "",
      premium: data.client?.policy?.premium ?? "",
      dueDay: String(data.client?.policy?.dueDay ?? 1),
      docsArriveDays: String(data.client?.policy?.docsArriveDays ?? 10),
      effectiveDate: String(data.client?.policy?.effectiveDate ?? "").slice(0, 10),
    });
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Load failed"));
  }, [businessId, clientId]);

  const dayOptions = useMemo(() => {
    const month = Number(holidayMonth) || 12;
    return Array.from({ length: daysInMonth(month) }, (_, i) => i + 1);
  }, [holidayMonth]);

  async function setStatus(status: string) {
    setBusy(true);
    setPressingStatus(status);
    setFlashStatus(null);
    setError(null);
    setStatusMessage(null);
    setMessage(null);
    setClient((prev) => {
      if (!prev || prev.smsOptedOut) return prev;
      return {
        ...prev,
        policy: {
          ...prev.policy,
          status,
        },
      };
    });
    try {
      const res = await fetch(
        `/api/insurance/${encodeURIComponent(businessId)}/clients/${encodeURIComponent(clientId)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Status update failed.");
      setClient(data.client);
      setStatusMessage(
        data.message
        || STATUS_FEEDBACK[status]
        || "Status updated.",
      );
      setFlashStatus(status);
      window.setTimeout(() => setFlashStatus((prev) => (prev === status ? null : prev)), 700);
      await load();
      statusSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      await load();
    } finally {
      setBusy(false);
      setPressingStatus(null);
    }
  }

  async function saveCustom(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const templateOverrides: Record<string, string> = {};
      for (const { key } of OVERRIDE_KEYS) {
        const value = String(overrides[key] ?? "").trim();
        if (value) templateOverrides[key] = value;
      }
      const res = await fetch(
        `/api/insurance/${encodeURIComponent(businessId)}/clients/${encodeURIComponent(clientId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: profile.name,
            phone: profile.phone,
            email: profile.email,
            birthday: profile.birthday || null,
            address: profile.address || null,
            policy: {
              carrier: profile.carrier,
              policyNumber: profile.policyNumber,
              premium: profile.premium,
              dueDay: Number(profile.dueDay) || 1,
              docsArriveDays: Number(profile.docsArriveDays) || 10,
              effectiveDate: profile.effectiveDate || null,
              status: client?.policy?.status || "active",
            },
            holidayMonth: holidayMonth === "" ? null : Number(holidayMonth),
            holidayDay: holidayDay === "" ? null : Number(holidayDay),
            templateOverrides,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setClient(data.client);
      setMessage("Client details saved. Scheduled texts use this on the next 1:00 PM UTC job.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !client) return <div className="fe-card"><p>{error}</p></div>;
  if (!client) return <div className="fe-card"><p className="fe-muted">Loading…</p></div>;

  const currentPolicyStatus = client.smsOptedOut ? "sms_opt_out" : (client.policy?.status || "active");
  const policyBtnClass = (target: string, warn = false) => {
    const base = `${warn ? "fe-btn warn" : "fe-btn secondary"} fe-status-btn`;
    const current = !client.smsOptedOut && currentPolicyStatus === target ? " is-current" : "";
    const pressing = busy && pressingStatus === target ? " is-pressing" : "";
    const flash = flashStatus === target ? " just-updated" : "";
    return base + current + pressing + flash;
  };

  const policyBtnLabel = (target: string, label: string) => {
    if (busy && pressingStatus === target) return "Saving…";
    return label;
  };

  return (
    <>
      {busy && pressingStatus ? (
        <div className="fe-status-banner busy" role="status">
          Updating policy to {pressingStatus}…
        </div>
      ) : null}
      {!busy && statusMessage ? (
        <div className="fe-status-banner ok" role="status">{statusMessage}</div>
      ) : null}
      {!busy && error ? (
        <div className="fe-status-banner err" role="alert">{error}</div>
      ) : null}
      <p style={{ marginBottom: "0.75rem" }}>
        <Link href={`/insurance/${businessId}/clients`} className="fe-muted">← Clients</Link>
      </p>
      <div className="fe-card" ref={statusSectionRef}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: "0 0 0.35rem" }}>{client.name}</h2>
            <p className="fe-muted" style={{ margin: 0 }}>{client.phone}{client.email ? ` · ${client.email}` : ""}</p>
            {client.birthday ? <p className="fe-muted">Birthday: {client.birthday}</p> : null}
            {client.smsOptedOut ? (
              <p className="fe-muted">SMS paused — client opted out (STOP).</p>
            ) : null}
            {client.reinstatementStatus === "open" ? (
              <p className="fe-muted">They replied YES — follow up to reinstate.</p>
            ) : null}
          </div>
          <FeStatusBadge
            size="lg"
            status={client.smsOptedOut ? "sms_opt_out" : (client.policy?.status || "active")}
            label={client.smsOptedOut ? "SMS paused" : undefined}
          />
        </div>

        <h3 style={{ marginTop: "1rem" }}>Policy status</h3>
        <p className="fe-muted" style={{ marginBottom: 0 }}>
          Tap a status — the badge above updates instantly. Missed/lapsed also texts the client and emails the agency owner.
        </p>
        <div className="fe-status-segment">
          <button type="button" className={policyBtnClass("missed", true)} disabled={busy} onClick={() => setStatus("missed")}>
            {policyBtnLabel("missed", "Mark missed")}
          </button>
          <button type="button" className={policyBtnClass("lapsed", true)} disabled={busy} onClick={() => setStatus("lapsed")}>
            {policyBtnLabel("lapsed", "Mark lapsed")}
          </button>
          <button type="button" className={policyBtnClass("active")} disabled={busy} onClick={() => setStatus("active")}>
            {policyBtnLabel("active", "Mark reinstated")}
          </button>
          <button type="button" className={policyBtnClass("cancelled")} disabled={busy} onClick={() => setStatus("cancelled")}>
            {policyBtnLabel("cancelled", "Cancelled")}
          </button>
        </div>
      </div>

      <form className="fe-card" onSubmit={saveCustom}>
        <h3>Edit client &amp; policy</h3>
        <p className="fe-muted">Update contact or policy details. Saves on submit.</p>
        <div className="fe-grid-2">
          <div className="fe-field">
            <label className="fe-label">Full name</label>
            <input className="fe-input" required value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </div>
          <div className="fe-field">
            <label className="fe-label">Phone</label>
            <input className="fe-input" required value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+1 603 818 2383" />
          </div>
          <div className="fe-field">
            <label className="fe-label">Email</label>
            <input className="fe-input" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
          </div>
          <div className="fe-field">
            <label className="fe-label">Birthday</label>
            <input className="fe-input" type="date" value={profile.birthday} onChange={(e) => setProfile({ ...profile, birthday: e.target.value })} />
          </div>
          <div className="fe-field">
            <label className="fe-label">Carrier</label>
            <input className="fe-input" value={profile.carrier} onChange={(e) => setProfile({ ...profile, carrier: e.target.value })} />
          </div>
          <div className="fe-field">
            <label className="fe-label">Policy number</label>
            <input className="fe-input" value={profile.policyNumber} onChange={(e) => setProfile({ ...profile, policyNumber: e.target.value })} />
          </div>
          <div className="fe-field">
            <label className="fe-label">Premium</label>
            <input className="fe-input" value={profile.premium} onChange={(e) => setProfile({ ...profile, premium: e.target.value })} />
          </div>
          <div className="fe-field">
            <label className="fe-label">Payment due day (1–28)</label>
            <input className="fe-input" type="number" min={1} max={28} value={profile.dueDay} onChange={(e) => setProfile({ ...profile, dueDay: e.target.value })} />
          </div>
          <div className="fe-field">
            <label className="fe-label">Papers-arrive days</label>
            <input className="fe-input" type="number" min={1} max={60} value={profile.docsArriveDays} onChange={(e) => setProfile({ ...profile, docsArriveDays: e.target.value })} />
          </div>
          <div className="fe-field">
            <label className="fe-label">Effective date</label>
            <input className="fe-input" type="date" value={profile.effectiveDate} onChange={(e) => setProfile({ ...profile, effectiveDate: e.target.value })} />
          </div>
        </div>
        <div className="fe-field">
          <label className="fe-label">Address</label>
          <input className="fe-input" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
        </div>

        <h3>Custom messages for this client</h3>
        <p className="fe-muted">
          Leave blank to use Settings defaults. Override holiday date or copy per client here.
        </p>

        <div className="fe-field">
          <label className="fe-label">Holiday send date (optional override)</label>
          <div className="fe-grid-2">
            <select
              className="fe-select"
              value={holidayMonth}
              onChange={(e) => setHolidayMonth(e.target.value)}
            >
              <option value="">Book default</option>
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select
              className="fe-select"
              value={holidayDay}
              onChange={(e) => setHolidayDay(e.target.value)}
              disabled={!holidayMonth}
            >
              <option value="">Book default</option>
              {dayOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {OVERRIDE_KEYS.map(({ key, label }) => (
          <div className="fe-field" key={key}>
            <span className="fe-template-title">{label}</span>
            <textarea
              className="fe-input"
              rows={3}
              placeholder="Leave blank to use Settings default"
              value={overrides[key] ?? ""}
              onChange={(e) => setOverrides({ ...overrides, [key]: e.target.value })}
              style={{ resize: "vertical", minHeight: 72 }}
            />
          </div>
        ))}

        {message ? <p style={{ color: "#34d399" }}>{message}</p> : null}
        <button type="submit" className="fe-btn" disabled={busy}>
          {busy ? "Saving…" : "Save client"}
        </button>
      </form>

      <div className="fe-card">
        <h3>Message history</h3>
        {history.some((row) => row.channel === "sms" && row.ok) ? (
          <p className="fe-muted" style={{ marginTop: 0 }}>
            “Sent to carrier” means Twilio accepted the message. Delivery to the phone requires your A2P campaign to be approved.
          </p>
        ) : null}
        {!history.length ? (
          <p className="fe-muted" style={{ margin: 0 }}>No messages yet.</p>
        ) : (
          <table className="fe-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Message</th>
                <th>To</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id}>
                  <td>{row.at ? new Date(row.at).toLocaleString() : "—"}</td>
                  <td>{row.kindLabel || feSendReasonLabel(row.kind)}</td>
                  <td>{row.to || row.channelLabel || row.channel}</td>
                  <td>{formatLogStatus(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
