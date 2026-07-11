"use client";

import type { ReactNode } from "react";

/**
 * Navigation Renderer — presents Business OS navigation sections.
 * Sections are composed upstream from installed modules + role access (never arbitrary routes).
 */
export default function NavigationRenderer({
  sections,
  renderItem,
}: {
  sections: Array<{ id: string; title: string; items: any[] }>;
  renderItem: (item: any, active: boolean) => ReactNode;
  activeModuleId?: string | null;
}) {
  return (
    <nav aria-label="Business navigation" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {sections.map((section) => (
        <div key={section.id}>
          {section.title ? (
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", opacity: 0.6, marginBottom: 6 }}>
              {section.title}
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 2 }}>
            {section.items.map((item) => (
              <div key={item.id ?? item.moduleId}>{renderItem(item, false)}</div>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
