"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

import PrimaryButton from "@/components/product/PrimaryButton";
import SecondaryButton from "@/components/product/SecondaryButton";
import {
  VtCard,
  VtDock,
  VtDockButton,
  VtDockLink,
  VtEmpty,
  VtFilterChip,
  VtHero,
  VtPage,
  VtPanel,
  VtStatusChip,
  vtInputStyle,
} from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

type ConferenceType = "none" | "google_meet" | "zoom";

/** ISO → datetime-local value in the browser's local timezone (never raw UTC slice). */
function isoToDatetimeLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type CalEvent = {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  source?: string;
  visibility?: string;
  createdBy?: string | null;
  htmlLink?: string | null;
  conferenceUrl?: string | null;
  conferenceType?: string | null;
};

type Filter = "org" | "me" | "team" | "all";

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDayLabel(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatRange(startISO: string, endISO?: string | null) {
  const s = new Date(startISO);
  if (Number.isNaN(s.getTime())) return "";
  const startLabel = s.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (!endISO) return startLabel;
  const e = new Date(endISO);
  if (Number.isNaN(e.getTime())) return startLabel;
  return `${startLabel} – ${e.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

const DURATION_PRESETS = [
  { mins: 30, label: "30m" },
  { mins: 60, label: "1h" },
  { mins: 90, label: "1.5h" },
  { mins: 120, label: "2h" },
] as const;

export default function CalendarExperience({
  businessId,
  integrationsHref,
  currentUserId = null,
}: {
  businessId: string;
  integrationsHref: string;
  currentUserId?: string | null;
}) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [conferenceType, setConferenceType] = useState<ConferenceType>("none");
  const [conferenceUrl, setConferenceUrl] = useState("");
  const [filter, setFilter] = useState<Filter>("org");
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [meetAppsOpen, setMeetAppsOpen] = useState(false);
  const [durationMins, setDurationMins] = useState(60);

  // Keep start/end as datetime-local strings, but drive them from clearer controls
  function setStartFromParts(date: string, time: string) {
    if (!date || !time) return;
    const next = `${date}T${time}`;
    setStart(next);
    if (durationMins > 0) {
      const endDate = new Date(`${next}:00`);
      if (!Number.isNaN(endDate.getTime())) {
        endDate.setMinutes(endDate.getMinutes() + durationMins);
        setEnd(toLocalInput(endDate));
      }
    }
  }

  function applyDuration(mins: number) {
    setDurationMins(mins);
    if (!start) return;
    const endDate = new Date(`${start}:00`);
    if (Number.isNaN(endDate.getTime())) return;
    endDate.setMinutes(endDate.getMinutes() + mins);
    setEnd(toLocalInput(endDate));
  }

  const startDate = start ? start.slice(0, 10) : "";
  const startTime = start && start.includes("T") ? start.slice(11, 16) : "";
  const endDate = end ? end.slice(0, 10) : "";
  const endTime = end && end.includes("T") ? end.slice(11, 16) : "";

  const load = useCallback(async () => {
    const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/calendar`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not load calendar");
    setEvents(data.events ?? []);
    setConnected(Boolean(data.googleMirrorConnected ?? data.calendarConnected));
  }, [businessId]);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Load failed"));
  }, [load]);

  const visible = useMemo(() => {
    return events.filter((e) => {
      if (filter === "all") return true;
      if (filter === "org") {
        return e.visibility === "org" || e.source === "google_calendar" || e.source === "vibetech" || e.source === "google_mirror" || !e.visibility;
      }
      if (filter === "me") {
        if (!currentUserId) return e.visibility === "member" || e.source === "member_calendar";
        return e.createdBy === currentUserId || e.visibility === "member" || e.source === "member_calendar";
      }
      return e.source === "member_calendar" || e.visibility === "member" || e.source === "free_busy";
    });
  }, [events, filter, currentUserId]);

  const weekAnchor = useMemo(() => startOfWeek(anchor), [anchor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)), [weekAnchor]);
  const monthDays = useMemo(() => buildMonthGrid(anchor), [anchor]);
  const dayEvents = useMemo(
    () => visible.filter((e) => {
      const s = new Date(e.start);
      return !Number.isNaN(s.getTime()) && sameDay(s, anchor);
    }).sort((a, b) => String(a.start).localeCompare(String(b.start))),
    [visible, anchor],
  );

  function goToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setAnchor(d);
  }

  function goPrev() {
    if (view === "day") setAnchor((d) => addDays(d, -1));
    else if (view === "week") setAnchor((d) => addDays(d, -7));
    else setAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function goNext() {
    if (view === "day") setAnchor((d) => addDays(d, 1));
    else if (view === "week") setAnchor((d) => addDays(d, 7));
    else setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  async function connectGoogleCalendar() {
    setOauthBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/integrations/calendar/oauth/start`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            returnTo: `/b/${encodeURIComponent(businessId)}/calendar`,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.authorizeUrl) {
        throw new Error(data.error ?? "Could not start Google Calendar connect");
      }
      window.location.href = String(data.authorizeUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google connect failed");
      setOauthBusy(false);
    }
  }

  async function createEvent() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/calendar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          conferenceType,
          conferenceUrl: conferenceType === "zoom" ? conferenceUrl.trim() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not create event");
      if (data.meetCreated) setNotice("Google Meet link created and saved on the event.");
      else if (data.conferenceWarning) setNotice(String(data.conferenceWarning));
      setTitle("");
      setDescription("");
      setStart("");
      setEnd("");
      setConferenceType("none");
      setConferenceUrl("");
      setComposerOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function cancelEvent(eventId: string, eventTitle: string) {
    if (!window.confirm(`Cancel “${eventTitle}”?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/calendar`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: eventId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not cancel event");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  }

  async function beginEdit(event: CalEvent) {
    setComposerOpen(true);
    setMeetAppsOpen(false);
    setTitle(event.title || "");
    setDescription(event.description || "");
    setStart(isoToDatetimeLocal(event.start));
    setEnd(isoToDatetimeLocal(event.end));
    setConferenceType((event.conferenceType as ConferenceType) || "none");
    setConferenceUrl(event.conferenceUrl || "");
    setEditingEventId(event.id);
    setNotice(null);
    setError(null);
  }

  async function saveEvent() {
    if (editingEventId) {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/calendar`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: editingEventId,
            title,
            description,
            start: start ? new Date(start).toISOString() : "",
            end: end ? new Date(end).toISOString() : "",
            conferenceType,
            conferenceUrl: conferenceType === "zoom" ? conferenceUrl.trim() : undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not update event");
        setEditingEventId(null);
        setTitle("");
        setDescription("");
        setStart("");
        setEnd("");
        setConferenceType("none");
        setConferenceUrl("");
        setComposerOpen(false);
        setNotice("Event updated.");
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
      } finally {
        setBusy(false);
      }
      return;
    }
    return createEvent();
  }

  return (
    <VtPage maxWidth="none">
      <VtHero
        eyebrow="Mission · Calendar"
        title="Club calendar"
        right={<VtStatusChip label={connected ? "MEET READY" : "VIBETECH"} tone={connected ? "live" : "warn"} />}
      >
        <VtDock>
          <VtDockButton
            active={meetAppsOpen}
            onClick={() => {
              setMeetAppsOpen((v) => !v);
              setComposerOpen(false);
            }}
          >
            Meet apps
          </VtDockButton>
          <VtDockLink href={`/b/${encodeURIComponent(businessId)}/automations`}>
            Reminder AI
          </VtDockLink>
          <VtDockButton
            active={composerOpen}
            onClick={() => {
              setComposerOpen((v) => !v);
              setMeetAppsOpen(false);
              if (composerOpen) setEditingEventId(null);
            }}
          >
            {composerOpen ? "Close" : "+ New event"}
          </VtDockButton>
        </VtDock>
        <div style={{ fontSize: 14, opacity: 0.9, fontWeight: 650, maxWidth: 760, lineHeight: 1.45 }}>
          Org schedule lives in VIBETech. Connect Google Calendar here for Meet auto-create.
          Zoom links paste on each event. Reminders fire at 24h · 1h · 10m.
        </div>
      </VtHero>

      {meetAppsOpen ? (
        <VtPanel title="Meet apps">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            <VtCard padding={16} accent={connected}>
              <div style={{ fontWeight: 900, fontSize: 17, color: cockpitColors.textPrimary }}>Google Meet</div>
              <div style={{ fontSize: 14, color: cockpitColors.textSecondary, marginTop: 6, lineHeight: 1.45, fontWeight: 600 }}>
                Uses your connected <strong>Google Calendar</strong>. When you create an event with Google Meet selected, Google generates the meet.google.com link automatically.
              </div>
              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span style={{
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: connected ? cockpitColors.handled : cockpitColors.warning,
                }}
                >
                  {connected ? "Connected" : "Not connected"}
                </span>
                <PrimaryButton onClick={() => void connectGoogleCalendar()} disabled={oauthBusy}>
                  {oauthBusy ? "…" : connected ? "Reconnect Google" : "Connect Google Calendar"}
                </PrimaryButton>
              </div>
            </VtCard>

            <VtCard padding={16}>
              <div style={{ fontWeight: 900, fontSize: 17, color: cockpitColors.textPrimary }}>Zoom</div>
              <div style={{ fontSize: 14, color: cockpitColors.textSecondary, marginTop: 6, lineHeight: 1.45, fontWeight: 600 }}>
                Paste a Zoom join URL when you create an event (Conference → Zoom). Full Zoom OAuth auto-create is next — no separate Integrations card yet.
              </div>
              <div style={{ marginTop: 12 }}>
                <SecondaryButton
                  onClick={() => {
                    setMeetAppsOpen(false);
                    setComposerOpen(true);
                    setConferenceType("zoom");
                  }}
                >
                  Create event with Zoom
                </SecondaryButton>
              </div>
            </VtCard>
          </div>
        </VtPanel>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {(["org", "me", "team", "all"] as Filter[]).map((f) => (
          <VtFilterChip key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</VtFilterChip>
        ))}
        <span style={{ flex: 1 }} />
        <VtFilterChip active={view === "day"} onClick={() => setView("day")}>Day</VtFilterChip>
        <VtFilterChip active={view === "week"} onClick={() => setView("week")}>Week</VtFilterChip>
        <VtFilterChip active={view === "month"} onClick={() => setView("month")}>Month</VtFilterChip>
        <SecondaryButton onClick={goPrev}>←</SecondaryButton>
        <SecondaryButton onClick={goToday}>Today</SecondaryButton>
        <SecondaryButton onClick={goNext}>→</SecondaryButton>
      </div>

      {composerOpen ? (
        <VtPanel title="New org event">
          <div style={{ display: "grid", gap: 12 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Subject / title" style={vtInputStyle} />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Body / notes (agenda, what to bring…)"
              rows={3}
              style={vtInputStyle}
            />
            <div style={{
              display: "grid",
              gap: 12,
              padding: 14,
              borderRadius: 14,
              border: `1px solid ${cockpitColors.panelBorder}`,
              background: cockpitColors.inset,
            }}
            >
              <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
                When
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }} className="vt-cal-times">
                <label style={fieldLabel}>
                  Date
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartFromParts(e.target.value, startTime || "09:00")}
                    style={{ ...vtInputStyle, fontSize: 16, minHeight: 48 }}
                  />
                </label>
                <label style={fieldLabel}>
                  Start time
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartFromParts(startDate || toLocalInput(new Date()).slice(0, 10), e.target.value)}
                    style={{ ...vtInputStyle, fontSize: 16, minHeight: 48 }}
                  />
                </label>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
                  Length
                </span>
                {DURATION_PRESETS.map((p) => (
                  <VtFilterChip key={p.mins} active={durationMins === p.mins} onClick={() => applyDuration(p.mins)}>
                    {p.label}
                  </VtFilterChip>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }} className="vt-cal-times">
                <label style={fieldLabel}>
                  End date
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      const t = endTime || startTime || "10:00";
                      setEnd(`${e.target.value}T${t}`);
                    }}
                    style={{ ...vtInputStyle, fontSize: 16, minHeight: 48 }}
                  />
                </label>
                <label style={fieldLabel}>
                  End time
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => {
                      const d = endDate || startDate || toLocalInput(new Date()).slice(0, 10);
                      setEnd(`${d}T${e.target.value}`);
                      setDurationMins(0);
                    }}
                    style={{ ...vtInputStyle, fontSize: 16, minHeight: 48 }}
                  />
                </label>
              </div>

              {start && end ? (
                <div style={{ fontSize: 15, fontWeight: 800, color: cockpitColors.textPrimary }}>
                  {formatRange(start, end)}
                  <span style={{ color: cockpitColors.textMuted, fontWeight: 650 }}> · local time</span>
                </div>
              ) : null}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
                Conference
              </span>
              {([
                { id: "none", label: "None" },
                { id: "google_meet", label: "Google Meet" },
                { id: "zoom", label: "Zoom" },
              ] as const).map((opt) => (
                <VtFilterChip
                  key={opt.id}
                  active={conferenceType === opt.id}
                  onClick={() => setConferenceType(opt.id)}
                >
                  {opt.label}
                </VtFilterChip>
              ))}
            </div>

            {conferenceType === "google_meet" ? (
              <div style={{ fontSize: 14, color: cockpitColors.textSecondary, fontWeight: 650, lineHeight: 1.45 }}>
                {connected
                  ? "Meet link will be created automatically on your connected Google Calendar."
                  : (
                    <>
                      Google Calendar not connected yet.{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setComposerOpen(false);
                          setMeetAppsOpen(true);
                        }}
                        style={{ border: "none", background: "transparent", color: cockpitColors.accent, fontWeight: 900, cursor: "pointer", fontSize: 14, padding: 0 }}
                      >
                        Open Meet apps →
                      </button>
                    </>
                  )}
              </div>
            ) : null}

            {conferenceType === "zoom" ? (
              <div style={{ display: "grid", gap: 8 }}>
                <input
                  value={conferenceUrl}
                  onChange={(e) => setConferenceUrl(e.target.value)}
                  placeholder="https://zoom.us/j/… (paste join link)"
                  style={vtInputStyle}
                />
                <div style={{ fontSize: 14, color: cockpitColors.textSecondary, fontWeight: 650 }}>
                  Paste a Zoom link for now. Auto-create arrives when Zoom OAuth is live.
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <PrimaryButton
                onClick={() => void saveEvent()}
                disabled={busy || !title || !start || !end || (conferenceType === "zoom" && !conferenceUrl.trim())}
              >
                {busy ? "…" : (editingEventId ? "Save changes" : "Deploy")}
              </PrimaryButton>
            </div>
          </div>
        </VtPanel>
      ) : null}

      {view === "day" ? (
        <VtPanel
          title={anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        >
          <div
            style={{
              minHeight: "min(72vh, 820px)",
              height: "72vh",
              borderRadius: 14,
              border: `2px solid ${sameDay(anchor, new Date()) ? cockpitColors.accent : cockpitColors.panelBorder}`,
              background: sameDay(anchor, new Date())
                ? `linear-gradient(180deg, rgba(34,211,238,0.12), ${cockpitColors.panel} 120px)`
                : cockpitColors.panel,
              padding: 16,
              overflowY: "auto",
              display: "grid",
              gap: 12,
              alignContent: "start",
              boxShadow: "0 8px 24px rgba(7,11,20,0.35)",
            }}
          >
            {dayEvents.length === 0 ? <VtEmpty label="No events this day — create one with + New event" /> : null}
            {dayEvents.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                large
                onCancel={() => void cancelEvent(e.id, e.title)}
                onEdit={() => void beginEdit(e)}
              />
            ))}
          </div>
        </VtPanel>
      ) : null}

      {view === "week" ? (
        <VtPanel title={`Week · ${formatDayLabel(weekAnchor)}`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(130px, 1fr))", gap: 10, overflowX: "auto" }}>
            {weekDays.map((day) => {
              const eventsForDay = visible.filter((e) => {
                const s = new Date(e.start);
                return !Number.isNaN(s.getTime()) && sameDay(s, day);
              });
              const isToday = sameDay(day, new Date());
              const isSelected = sameDay(day, anchor);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => {
                    setAnchor(day);
                    setView("day");
                  }}
                  style={{
                    minHeight: "min(58vh, 640px)",
                    height: "58vh",
                    borderRadius: 14,
                    border: `2px solid ${isToday || isSelected ? cockpitColors.accent : cockpitColors.panelBorder}`,
                    background: isToday
                      ? `linear-gradient(180deg, rgba(34,211,238,0.14), ${cockpitColors.panel})`
                      : cockpitColors.panel,
                    padding: 10,
                    display: "grid",
                    gap: 8,
                    alignContent: "start",
                    overflowY: "auto",
                    boxShadow: isToday ? "0 0 0 1px rgba(34,211,238,0.25), 0 8px 20px rgba(7,11,20,0.35)" : "0 4px 14px rgba(7,11,20,0.25)",
                    cursor: "pointer",
                    textAlign: "left",
                    font: "inherit",
                    color: cockpitColors.textPrimary,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase", color: cockpitColors.textPrimary }}>
                    {formatDayLabel(day)}
                  </div>
                  {eventsForDay.map((e) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      onCancel={() => void cancelEvent(e.id, e.title)}
                      onEdit={() => void beginEdit(e)}
                    />
                  ))}
                  {eventsForDay.length === 0 ? <div style={{ fontSize: 13, color: cockpitColors.textMuted, fontWeight: 700 }}>—</div> : null}
                </button>
              );
            })}
          </div>
        </VtPanel>
      ) : null}

      {view === "month" ? (
        <VtPanel title={anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", color: cockpitColors.textMuted, padding: "4px 6px" }}>
                {d}
              </div>
            ))}
            {monthDays.map((day) => {
              const inMonth = day.getMonth() === anchor.getMonth();
              const eventsForDay = visible.filter((e) => {
                const s = new Date(e.start);
                return !Number.isNaN(s.getTime()) && sameDay(s, day);
              });
              const isToday = sameDay(day, new Date());
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => {
                    setAnchor(day);
                    setView("day");
                  }}
                  style={{
                    minHeight: 110,
                    borderRadius: 12,
                    border: `2px solid ${isToday ? cockpitColors.accent : cockpitColors.panelBorder}`,
                    background: inMonth ? cockpitColors.panel : cockpitColors.inset,
                    color: cockpitColors.textPrimary,
                    padding: 8,
                    display: "grid",
                    gap: 4,
                    alignContent: "start",
                    opacity: inMonth ? 1 : 0.55,
                    cursor: "pointer",
                    textAlign: "left",
                    font: "inherit",
                    boxShadow: "0 2px 8px rgba(28,25,23,0.05)",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 900, color: cockpitColors.textPrimary }}>{day.getDate()}</div>
                  {eventsForDay.slice(0, 3).map((e) => (
                    <div
                      key={e.id}
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        borderRadius: 6,
                        padding: "3px 6px",
                        background: "rgba(15,118,110,0.12)",
                        color: cockpitColors.accent,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.title}
                    </div>
                  ))}
                  {eventsForDay.length > 3 ? (
                    <div style={{ fontSize: 11, fontWeight: 800, color: cockpitColors.textMuted }}>
                      +{eventsForDay.length - 3} more
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </VtPanel>
      ) : null}

      {notice ? <p style={{ color: cockpitColors.accent, fontWeight: 900, fontSize: 14 }}>{notice}</p> : null}
      {error ? <p style={{ color: cockpitColors.critical, fontWeight: 900, fontSize: 14 }}>{error}</p> : null}
      <style>{`
        @media (max-width: 900px) {
          .vt-cal-times { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </VtPage>
  );
}

function buildMonthGrid(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function EventCard({
  event,
  large = false,
  onCancel,
  onEdit,
}: {
  event: CalEvent;
  large?: boolean;
  onCancel?: () => void;
  onEdit?: () => void;
}) {
  return (
    <div
      style={{
        borderRadius: large ? 14 : 10,
        background: cockpitColors.panelElevated,
        border: `1px solid ${cockpitColors.panelBorder}`,
        color: cockpitColors.textPrimary,
        padding: large ? "14px 16px" : "8px 10px",
        fontSize: large ? 16 : 14,
        fontWeight: 750,
        boxShadow: large ? "0 6px 18px rgba(7,11,20,0.35)" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 900, color: cockpitColors.textPrimary }}>{event.title}</div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {onEdit ? (
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                onEdit();
              }}
              style={{
                border: "none",
                background: "transparent",
                color: cockpitColors.accent,
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Edit
            </button>
          ) : null}
          {onCancel ? (
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                onCancel();
              }}
              style={{
                border: "none",
                background: "transparent",
                color: cockpitColors.textMuted,
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
      {large && event.description ? (
        <div style={{ fontSize: 14, color: cockpitColors.textSecondary, marginTop: 6, fontWeight: 600 }}>
          {event.description}
        </div>
      ) : null}
      <div style={{ color: cockpitColors.textMuted, marginTop: 4, fontWeight: 700, fontSize: large ? 14 : 13 }}>
        {formatRange(event.start, event.end)}
      </div>
      {event.conferenceUrl ? (
        <a
          href={event.conferenceUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(ev) => ev.stopPropagation()}
          style={{ display: "inline-block", marginTop: 8, color: cockpitColors.accent, fontWeight: 900, fontSize: large ? 14 : 13 }}
        >
          {event.conferenceType === "zoom" ? "Join Zoom" : "Join Meet"} →
        </a>
      ) : null}
    </div>
  );
}

const fieldLabel: CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: cockpitColors.textMuted,
};
