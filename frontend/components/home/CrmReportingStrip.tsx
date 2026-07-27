"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { VtMetricStrip } from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

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
  const [strip, setStrip] = useState<{
    contactCount: number;
    openOpportunities: number;
    upcomingEvents: number;
    nextEventTitle?: string | null;
  } | null>(null);

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
        const cards = (pipes.pipelines ?? []).flatMap((p: any) => p.cards ?? []);
        const open = cards.filter((c: any) => !String(c.stageId).includes("won") && !String(c.stageId).includes("lost"));
        const upcoming = (cal.events ?? []).filter((e: any) => e.start && String(e.start) >= new Date().toISOString());
        setStrip({
          contactCount: (contacts.contacts ?? []).length,
          openOpportunities: open.length,
          upcomingEvents: upcoming.length,
          nextEventTitle: upcoming[0]?.title ?? null,
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (!strip) return null;

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
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {showCalendar ? <QuickLink href={calendarHref}>Calendar</QuickLink> : null}
        {showPipelines ? <QuickLink href={pipelinesHref}>Pipelines</QuickLink> : null}
        {showAutomations ? <QuickLink href={automationsHref}>Loadouts</QuickLink> : null}
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
        background: "linear-gradient(180deg, #fff, #f5f5f4)",
        color: cockpitColors.textPrimary,
        textDecoration: "none",
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </Link>
  );
}
