"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { cockpitColors } from "@/design/tokens/colors";
import {
  MONTH_OPTIONS,
  daysInMonth,
  normalizeHolidayDate,
} from "../../../../../backend/core/fe-retention/FeRetentionLabels.js";
import { syncPaymentReminderTemplate } from "../../../../../backend/core/fe-retention/FeRetentionTemplates.js";
import { paymentReminderFieldLabel } from "../../../../../backend/core/fe-retention/FeRetentionSettingsCatalog.js";
import { FeStatusBadge } from "@/components/insurance/FeStatusBadge";

const TEMPLATE_KEYS = [
  "welcome",
  "docsMail",
  "paymentReminder",
  "birthday",
  "holiday",
  "lapseRecovery",
] as const;

function paymentReminderLabel(days: number) {
  return paymentReminderFieldLabel(days);
}

function templateTitle(key: string, reminderDaysBefore: number) {
  const map: Record<string, string> = {
    welcome: "Welcome",
    docsMail: "Policy papers in the mail",
    paymentReminder: paymentReminderLabel(reminderDaysBefore),
    birthday: "Birthday",
    holiday: "Holiday / Christmas",
    lapseRecovery: "Missed payment / lapse",
  };
  return map[key] ?? key;
}

export default function InsuranceSettingsPage() {
  const params = useParams();
  const businessId = String(params.businessId ?? "");
  const [settings, setSettings] = useState<any>(null);
  const [sms, setSms] = useState<any>(null);
  const [agentEmail, setAgentEmail] = useState<string | null>(null);
  const [gmail, setGmail] = useState<any>(null);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [applyTo, setApplyTo] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/insurance/${encodeURIComponent(businessId)}/settings`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not load settings.");
        const holiday = normalizeHolidayDate({
          month: data.settings?.holidayMonth ?? 12,
          day: data.settings?.holidayDay ?? 25,
        });
        const reminderDaysBefore = data.settings?.reminderDaysBefore ?? 3;
        const templates = { ...(data.settings?.templates ?? {}) };
        templates.paymentReminder = syncPaymentReminderTemplate(
          templates.paymentReminder,
          reminderDaysBefore,
        );
        setSettings({ ...data.settings, ...holiday, reminderDaysBefore, templates });
        setAgentEmail(data.agentEmail);
        setSms(data.sms ?? null);
        setGmail(data.gmail ?? null);
        setClients(Array.isArray(data.clients) ? data.clients : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
      }
    })();
  }, [businessId]);

  const reminderDays = Number(settings?.reminderDaysBefore ?? 3) || 3;
  const holidayMonth = Number(settings?.holidayMonth ?? 12) || 12;
  const dayOptions = useMemo(() => {
    const max = daysInMonth(holidayMonth);
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [holidayMonth]);

  async function saveHoliday(next: { holidayMonth: number; holidayDay: number }) {
    setSettings((prev: any) => ({ ...prev, ...next, holidayDateCustomized: true }));
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/insurance/${encodeURIComponent(businessId)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holidayMonth: next.holidayMonth,
          holidayDay: next.holidayDay,
          holidayDateCustomized: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save holiday date.");
      setSettings((prev: any) => ({
        ...prev,
        ...data.settings,
        ...normalizeHolidayDate({
          month: data.settings?.holidayMonth,
          day: data.settings?.holidayDay,
        }),
      }));
      setMessage("Holiday date saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save holiday date");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const holiday = normalizeHolidayDate({
        month: settings.holidayMonth,
        day: settings.holidayDay,
      });
      const reminderDaysBefore = Number(settings.reminderDaysBefore) || 3;
      const templates = {
        ...(settings.templates ?? {}),
        paymentReminder: syncPaymentReminderTemplate(
          settings.templates?.paymentReminder,
          reminderDaysBefore,
        ),
      };
      const res = await fetch(`/api/insurance/${encodeURIComponent(businessId)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentNotifyEmail: settings.agentNotifyEmail,
          agentNotifyPhone: settings.agentNotifyPhone,
          reminderDaysBefore,
          holidayMonth: holiday.holidayMonth,
          holidayDay: holiday.holidayDay,
          docsArriveDaysDefault: Number(settings.docsArriveDaysDefault) || 10,
          templates,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed.");
      setSettings({
        ...data.settings,
        ...normalizeHolidayDate({
          month: data.settings?.holidayMonth,
          day: data.settings?.holidayDay,
        }),
      });
      setMessage("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (error && !settings) return <div className="fe-card"><p>{error}</p></div>;
  if (!settings) return <div className="fe-card"><p className="fe-muted">Loading…</p></div>;

  return (
    <form className="fe-card" onSubmit={onSubmit}>
      <h2 style={{ marginTop: 0 }}>Settings</h2>
      <p className="fe-muted">
        Signed in as {agentEmail || "—"}.
        {settings.agentNotifyEmail ? (
          <> Alerts send to <strong>{settings.agentNotifyEmail}</strong>.</>
        ) : null}
      </p>

      <div className="fe-card" style={{ background: cockpitColors.inset }}>
        <h3>Text messaging</h3>
        <p style={{ margin: "0 0 0.75rem" }}>
          <FeStatusBadge status={sms?.ready ? "ok" : "missed"} label={sms?.badge || (sms?.ready ? "Active" : "Not ready")} />
        </p>
        <div className="fe-field" style={{ marginBottom: "0.75rem" }}>
          <div className="fe-label">Texts sent from this number</div>
          <p style={{ margin: "0.25rem 0 0", fontSize: "1.15rem", fontWeight: 600, letterSpacing: "0.02em" }}>
            {sms?.fromNumber || "Buying your number…"}
          </p>
        </div>
        <p className="fe-muted" style={{ margin: "0 0 0.85rem" }}>
          {sms?.fromNumber
            ? "Your agency number on all client texts."
            : (sms?.message || "Assigned automatically after you sign.")}
        </p>
        <p style={{ margin: 0, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <a href={`/insurance/${encodeURIComponent(businessId)}/agreement`} style={{ color: cockpitColors.accent, fontWeight: 600 }}>
            View signed agreement
          </a>
          <a href={`/api/insurance/${encodeURIComponent(businessId)}/agreement-pdf`} style={{ color: cockpitColors.accent, fontWeight: 600 }}>
            Download signed PDF
          </a>
        </p>
      </div>

      <div className="fe-card" style={{ background: cockpitColors.inset }}>
        <h3>Agent alerts</h3>
        <p className="fe-muted">
          Lapse detected → client gets recovery text → alerts go to the email below (from A2P signup unless you change it).
        </p>
        <div className="fe-field">
          <label className="fe-label">Notify email</label>
          <input
            className="fe-input"
            type="email"
            value={settings.agentNotifyEmail || ""}
            onChange={(e) => setSettings({ ...settings, agentNotifyEmail: e.target.value })}
            placeholder={agentEmail || "you@agency.com"}
          />
        </div>
        <div className="fe-field" style={{ marginBottom: 0 }}>
          <label className="fe-label">Notify phone (for alert texts)</label>
          <input
            className="fe-input"
            type="tel"
            value={settings.agentNotifyPhone || ""}
            onChange={(e) => setSettings({ ...settings, agentNotifyPhone: e.target.value })}
            placeholder="+1…"
          />
        </div>
      </div>

      <div className="fe-card" style={{ background: cockpitColors.inset }}>
        <h3>Gmail carrier notices</h3>
        <p className="fe-muted">
          Syncs your inbox for carrier lapse notices, matches clients, and triggers recovery + alerts.
        </p>
        <p style={{ margin: "0.5rem 0" }}>
          <FeStatusBadge status={gmail?.connected ? "ok" : "missed"} label={gmail?.connected ? "Connected" : "Not connected"} />
          {gmail?.lastSyncAt ? (
            <span className="fe-muted" style={{ marginLeft: 10 }}>
              Last sync {new Date(gmail.lastSyncAt).toLocaleString()}
            </span>
          ) : null}
        </p>
        <button
          type="button"
          className="fe-btn secondary"
          onClick={async () => {
            setError(null);
            try {
              const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/integrations/gmail/oauth/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ returnTo: `/insurance/${businessId}/settings` }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data.error || "Could not start Gmail connect.");
              if (data.authorizeUrl) window.location.assign(data.authorizeUrl);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Gmail connect failed");
            }
          }}
        >
          {gmail?.connected ? "Reconnect Gmail" : "Connect Gmail for carrier notices"}
        </button>
        {gmail?.connected ? (
          <button
            type="button"
            className="fe-btn secondary"
            style={{ marginLeft: "0.5rem" }}
            onClick={async () => {
              setError(null);
              try {
                const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/integrations/gmail/sync`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ maxResults: 40 }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || "Sync failed.");
                setMessage("Gmail synced.");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Gmail sync failed");
              }
            }}
          >
            Sync Gmail now
          </button>
        ) : null}
      </div>

      <h3>Timing</h3>
      <div className="fe-grid-2">
        <div className="fe-field">
          <label className="fe-label">Payment reminder (days before due)</label>
          <input
            className="fe-input"
            type="number"
            min={1}
            max={14}
            value={settings.reminderDaysBefore ?? 3}
            onChange={(e) => {
              const reminderDaysBefore = e.target.value;
              setSettings({
                ...settings,
                reminderDaysBefore,
                templates: {
                  ...(settings.templates ?? {}),
                  paymentReminder: syncPaymentReminderTemplate(
                    settings.templates?.paymentReminder,
                    reminderDaysBefore,
                  ),
                },
              });
            }}
          />
        </div>
        <div className="fe-field">
          <label className="fe-label">Default papers-arrive days</label>
          <input
            className="fe-input"
            type="number"
            min={1}
            max={60}
            value={settings.docsArriveDaysDefault ?? 10}
            onChange={(e) => setSettings({ ...settings, docsArriveDaysDefault: e.target.value })}
          />
        </div>
      </div>

      <div className="fe-field">
        <label className="fe-label">Holiday send date (book default)</label>
        <div className="fe-grid-2">
          <select
            className="fe-select"
            value={holidayMonth}
            onChange={(e) => {
              const month = Number(e.target.value) || 12;
              const next = normalizeHolidayDate({ month, day: settings.holidayDay });
              void saveHoliday(next);
            }}
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            className="fe-select"
            value={Number(settings.holidayDay ?? 25) || 25}
            onChange={(e) => {
              const next = normalizeHolidayDate({
                month: holidayMonth,
                day: Number(e.target.value) || 25,
              });
              void saveHoliday(next);
            }}
          >
            {dayOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <p className="fe-muted" style={{ margin: "0.35rem 0 0" }}>
          Saves instantly. Scheduled texts run daily at 1:00 PM UTC. Override per client on their page.
        </p>
      </div>

      <h3>Automatic messages</h3>
      <p className="fe-muted" style={{ marginBottom: "1rem" }}>
        Book-wide defaults. Override on a client page or apply below. Placeholders: {"{{firstName}}"}, {"{{carrier}}"}, {"{{docsArriveDays}}"}, {"{{reminderDays}}"}
      </p>
      {TEMPLATE_KEYS.map((key) => {
        const raw = settings.templates?.[key] ?? "";
        const display = key === "paymentReminder"
          ? String(raw).replaceAll("{{reminderDays}}", String(reminderDays))
          : raw;
        const selected = applyTo[key] ?? [];
        return (
          <div className="fe-field" key={key}>
            <span className="fe-template-title">{templateTitle(key, reminderDays)}</span>
            <textarea
              className="fe-input"
              rows={3}
              value={display}
              onChange={(e) => {
                let next = e.target.value;
                if (key === "paymentReminder") {
                  next = next.replace(
                    new RegExp(`due in ${reminderDays}\\s*days?`, "i"),
                    "due in {{reminderDays}} days",
                  );
                  next = syncPaymentReminderTemplate(next, reminderDays);
                }
                setSettings({
                  ...settings,
                  templates: {
                    ...(settings.templates ?? {}),
                    [key]: next,
                  },
                });
              }}
              style={{ resize: "vertical", minHeight: 72 }}
            />
            {clients.length ? (
              <div style={{ marginTop: "0.45rem" }}>
                <label className="fe-label">Apply this version only to</label>
                <select
                  className="fe-select"
                  multiple
                  value={selected}
                  onChange={(e) => {
                    const ids = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setApplyTo({ ...applyTo, [key]: ids });
                  }}
                  style={{ minHeight: 72 }}
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="fe-btn secondary"
                  style={{ marginTop: "0.4rem" }}
                  disabled={!selected.length || saving}
                  onClick={async () => {
                    setSaving(true);
                    setError(null);
                    try {
                      const res = await fetch(`/api/insurance/${encodeURIComponent(businessId)}/settings`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          applyTemplateToClients: {
                            key,
                            clientIds: selected,
                            template: settings.templates?.[key],
                          },
                        }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(data.error || "Could not apply to clients.");
                      setMessage(`Saved for ${selected.length} client${selected.length === 1 ? "" : "s"}. Others still use the book default.`);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Apply failed");
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  Apply to selected clients
                </button>
              </div>
            ) : null}
          </div>
        );
      })}

      {message ? <p style={{ color: cockpitColors.handled }}>{message}</p> : null}
      {error ? <p style={{ color: cockpitColors.critical }}>{error}</p> : null}
      <button type="submit" className="fe-btn" disabled={saving}>{saving ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
