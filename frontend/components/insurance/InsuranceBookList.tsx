import Link from "next/link";
import { insuranceDashboardPath } from "@/lib/platform/hosts";
import { brand } from "@/design/tokens/brand";
import type { FeRetentionBook } from "@/lib/platform/feRetentionAccess";
import type { ReactNode } from "react";

export function InsuranceBookList({
  books,
  emptyLabel = "No Final Expense Retention books yet.",
  openLabel = "Open dashboard",
  action = null,
}: {
  books: FeRetentionBook[];
  emptyLabel?: string;
  openLabel?: string;
  action?: ((book: FeRetentionBook) => ReactNode) | null;
}) {
  if (!books.length) {
    return <p style={{ color: brand.textMuted }}>{emptyLabel}</p>;
  }
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {books.map((book) => (
        <li
          key={book.id}
          style={{
            marginBottom: 12,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "baseline",
            flexWrap: "wrap",
          }}
        >
          <div>
            <Link href={insuranceDashboardPath(book.id)} style={{ color: brand.cyan, fontWeight: 700, fontSize: "1.05rem" }}>
              {book.name}
            </Link>
            <div style={{ color: brand.textMuted, fontSize: 13, marginTop: 2 }}>
              {book.allowsDashboard ? "Paid — same view as the agent" : `Payment ${book.billingStatus || "incomplete"}`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {action ? action(book) : null}
            <Link href={insuranceDashboardPath(book.id)} style={{ color: brand.cyan, fontWeight: 650, fontSize: 14 }}>
              {openLabel} →
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
