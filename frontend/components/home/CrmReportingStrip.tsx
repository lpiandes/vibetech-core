"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { VtMetricStrip } from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

type StripStats = {
  contactCount: number;
  openOpportunities: number;
  upcomingEvents: number;
  nextEventTitle?: string | null;
};

const EMPTY_STRIP: StripStats = {
  contactCount: 0,
  openOpportunities: 0,
  upcomingEvents: 0,
  nextEventTitle: null,
};

export default function CrmReportingStrip({
  businessId,
  inboxHref,
  calendarHref,
  pipelinesHref,
  automationsHref,
  showCalendar = true,
  showPipelines = true,
  showAutomations = true,
}: {
  businessId: string;
  inboxHref: string;
  calendarHref: string;
  pipelinesHref: string;
  automationsHref: string;
  showCalendar?: boolean;
  showPipelines?: boolean;
  showAutomations?: boolean;
}) {
  // Always paint the strip on first frame — never return null (that caused the home flicker).
  const [strip, setStrip] = useState<StripStats>(EMPTY_STRIP);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [contactsRes, pipesRes, calRes] = await Promise.all([
          fetch(`/api/businesses/${encodeURIComponent(businessId)}/contacts`),
          fetch(`/api/businesses/${encodeURIComponent(businessId)}/pipelines`),
          fetch(`/api/businesses/${encodeURIComponent(businessId)}/calendar`),
        ]);
        const contacts = await contactsRes.json().catch(() => ({}));
        const pipes = await pipesRes.json().catch(() => ({}));
        const cal = await calRes.json().catch(() => ({}));
        if (cancelled) return;
        if (!contactsRes.ok || !pipesRes.ok) {
          setLoadError("Couldn’t refresh People / Pipelines counts — try again.");
          return;
        }
        setLoadError(null);
        const cards = (pipes.pipelines ?? []).flatMap((p: any) => p.cards ?? []);
        const open = cards.filter((c: any) => !String(c.stageId).includes("won") && !String(c.stageId).includes("lost"));
        const upcoming = (cal.events ?? [])
          .filter((e: any) => e.start && String(e.start) >= new Date().toISOString())
          .sort((a: any, b: any) => String(a.start).localeCompare(String(b.start)));
        setStrip({
          contactCount: (contacts.contacts ?? []).length,
          openOpportunities: open.length,
          upcomingEvents: upcoming.length,
          nextEventTitle: upcoming[0]?.title ?? null,
        });
      } catch {
        if (!cancelled) setLoadError("Couldn’t refresh reporting strip.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <VtMetricStrip
        items={[
          { label: "Contacts", value: strip.contactCount, hint: "People" },
          { label: "Open", value: strip.openOpportunities, hint: "Pipelines" },
          { label: "Upcoming", value: strip.upcomingEvents, hint: strip.nextEventTitle || "Calendar" },
          { label: "Inbox", value: "→", hint: "Threads" },
        ]}
      />
      {loadError ? (
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: cockpitColors.critical }}>{loadError}</p>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {showCalendar ? <QuickLink href={calendarHref}>Calendar</QuickLink> : null}
        {showPipelines ? <QuickLink href={pipelinesHref}>Pipelines</QuickLink> : null}
        {showAutomations ? <QuickLink href={automationsHref}>Automations</QuickLink> : null}
        <QuickLink href={inboxHref}>Inbox</QuickLink>
      </div>
    </div>
  );
}

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        padding: "8px 12px",
        borderRadius: 10,
        border: `1px solid ${cockpitColors.panelBorder}`,
        background: cockpitColors.panel,
        color: cockpitColors.textPrimary,
        textDecoration: "none",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </Link>
  );
}
