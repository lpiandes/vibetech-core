"use client";

import type { ReactNode } from "react";
import { VtEmpty, VtPanel } from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

/**
 * Table inside a VtPanel — shared admin directory pattern.
 */
export default function AdminDataTable({
  title,
  right,
  headers,
  rows,
  emptyLabel = "Nothing here yet.",
}: {
  title: string;
  right?: ReactNode;
  headers: string[];
  rows: ReactNode[][];
  emptyLabel?: string;
}) {
  return (
    <VtPanel title={title} right={right}>
      {!rows.length ? (
        <VtEmpty label={emptyLabel} />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {headers.map((label) => (
                  <th
                    key={label}
                    style={{
                      textAlign: "left",
                      padding: "10px 8px",
                      borderBottom: `2px solid ${cockpitColors.inset}`,
                      fontSize: 11,
                      fontWeight: 900,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: cockpitColors.textMuted,
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((cells, index) => (
                <tr key={index}>
                  {cells.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      style={{
                        padding: "12px 8px",
                        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                        color: cockpitColors.textPrimary,
                        verticalAlign: "top",
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </VtPanel>
  );
}
