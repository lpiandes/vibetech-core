"use client";

import type { CSSProperties } from "react";
import SecondaryButton from "@/components/product/SecondaryButton";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

export type SpecialtyActivityCitation = {
  org?: string;
  title?: string;
  url?: string | null;
  knowledgeDocId?: string | null;
  provenance?: string | null;
  packId?: string | null;
};

export type SpecialtyActivity = {
  id?: string;
  name?: string;
  visual?: string | null;
  minutes?: number | null;
  durationLabel?: string | null;
  setup?: string | null;
  steps?: string[];
  citations?: SpecialtyActivityCitation[];
};

export type SpecialtyDiagramNode = {
  id?: string;
  index?: number;
  label?: string;
  intent?: string | null;
  durationLabel?: string | null;
  details?: string[];
  activities?: SpecialtyActivity[];
};

export type SpecialtyDiagram = {
  layout?: "timeline" | "station_board" | "sequence" | "cards";
  templateId?: string;
  vocabularyId?: string;
  header?: {
    title?: string;
    subtitle?: string;
    meta?: Array<{ label?: string; value?: string }>;
  };
  nodes?: SpecialtyDiagramNode[];
  sidePanels?: Array<{ id?: string; title?: string; items?: string[] }>;
  gaps?: Array<{ code?: string; message?: string }>;
};

export type SpecialtyArtifactPreview = {
  title?: string;
  body?: string;
  kind?: string;
  templateId?: string;
  diagram?: SpecialtyDiagram | null;
  workHref?: string | null;
  gaps?: Array<{ code?: string; message?: string }>;
  sources?: Array<{
    id?: string;
    org?: string;
    title?: string;
    url?: string | null;
    knowledgeDocId?: string | null;
  }>;
};

/**
 * Universal specialty deliverable renderer — layouts only, no industry codegen.
 */
export default function SpecialtyDeliverableView({
  artifact,
  openHref,
  knowledgeHref,
}: {
  artifact: SpecialtyArtifactPreview;
  openHref?: string | null;
  knowledgeHref?: string | null;
}) {
  const diagram = artifact.diagram ?? null;
  const layout = diagram?.layout ?? null;
  const gaps = Array.isArray(artifact.gaps) && artifact.gaps.length
    ? artifact.gaps
    : (Array.isArray(diagram?.gaps) ? diagram!.gaps! : []);

  return (
    <section style={{ display: "grid", gap: spacing.md }}>
      {gaps.length ? (
        <div
          style={{
            border: `1px solid ${cockpitColors.warning}`,
            borderRadius: radius.large,
            background: "rgba(180, 83, 9, 0.08)",
            padding: spacing.md,
            display: "grid",
            gap: spacing.sm,
          }}
        >
          <div style={{ fontWeight: 700, color: cockpitColors.textPrimary }}>
            Curriculum sources required
          </div>
          {gaps.map((gap) => (
            <p key={gap.code ?? gap.message} style={{ margin: 0, color: cockpitColors.textSecondary, lineHeight: 1.5 }}>
              {gap.message ?? gap.code}
            </p>
          ))}
          <p style={{ margin: 0, color: cockpitColors.textMuted, fontSize: typography.caption.fontSize, lineHeight: 1.5 }}>
            Add trusted materials for this specialty in Knowledge (governing-body curriculum, SOPs, manuals), then re-run.
            Matching domain authorities are consulted when registered; otherwise Knowledge is the source of truth. VIBETech will not invent specialty content.
          </p>
          {knowledgeHref ? <SecondaryButton href={knowledgeHref}>Open Knowledge</SecondaryButton> : null}
        </div>
      ) : null}

      {diagram?.header ? (
        <header style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ fontWeight: 700, fontSize: typography.cardTitle.fontSize, color: cockpitColors.textPrimary }}>
            {diagram.header.title || artifact.title}
          </div>
          {diagram.header.subtitle ? (
            <div style={{ color: cockpitColors.textSecondary, lineHeight: 1.5 }}>{diagram.header.subtitle}</div>
          ) : null}
          {Array.isArray(diagram.header.meta) && diagram.header.meta.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
              {diagram.header.meta.map((entry) => (
                <span
                  key={`${entry.label}-${entry.value}`}
                  style={{
                    borderRadius: radius.pill,
                    border: `1px solid ${cockpitColors.panelBorder}`,
                    background: cockpitColors.panel,
                    padding: "6px 10px",
                    fontSize: typography.caption.fontSize,
                    color: cockpitColors.textSecondary,
                  }}
                >
                  <strong style={{ color: cockpitColors.textPrimary }}>{entry.label}:</strong> {entry.value}
                </span>
              ))}
            </div>
          ) : null}
        </header>
      ) : (
        <div style={{ fontWeight: 700, color: cockpitColors.textPrimary }}>{artifact.title}</div>
      )}

      {layout === "timeline" || layout === "sequence" ? (
        <TimelineDiagram nodes={diagram?.nodes ?? []} />
      ) : null}
      {layout === "station_board" ? <StationBoard nodes={diagram?.nodes ?? []} /> : null}
      {layout === "cards" || !layout ? <CardGrid nodes={diagram?.nodes ?? []} fallbackBody={artifact.body} /> : null}

      {Array.isArray(diagram?.sidePanels) && diagram!.sidePanels!.length ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: spacing.md,
          }}
        >
          {diagram!.sidePanels!.map((panel) => (
            <aside
              key={panel.id ?? panel.title}
              style={{
                border: `1px solid ${cockpitColors.panelBorder}`,
                borderRadius: radius.large,
                padding: spacing.md,
                background: cockpitColors.panel,
              }}
            >
              <div style={{ fontWeight: 700, color: cockpitColors.textPrimary, marginBottom: spacing.sm }}>
                {panel.title}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: cockpitColors.textSecondary, lineHeight: 1.55 }}>
                {(panel.items ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </aside>
          ))}
        </div>
      ) : null}

      {openHref ? <SecondaryButton href={openHref}>Open in Work</SecondaryButton> : null}
    </section>
  );
}

function TimelineDiagram({ nodes }: { nodes: SpecialtyDiagramNode[] }) {
  return (
    <div style={{ position: "relative", display: "grid", gap: spacing.lg, paddingLeft: 18 }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 7,
          top: 8,
          bottom: 8,
          width: 2,
          background: `linear-gradient(180deg, ${cockpitColors.accent}, ${cockpitColors.panelBorder})`,
          borderRadius: 999,
        }}
      />
      {nodes.map((node) => (
        <article
          key={node.id ?? node.label}
          style={{
            position: "relative",
            marginLeft: spacing.md,
            border: `1px solid ${cockpitColors.panelBorder}`,
            borderRadius: radius.large,
            background: cockpitColors.panel,
            padding: spacing.md,
            display: "grid",
            gap: spacing.md,
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: -28,
              top: 18,
              width: 14,
              height: 14,
              borderRadius: 999,
              background: cockpitColors.accent,
              boxShadow: `0 0 0 4px ${cockpitColors.accentMuted}`,
            }}
          />
          <PhaseHeader node={node} />
          <PhaseBody node={node} />
        </article>
      ))}
    </div>
  );
}

function StationBoard({ nodes }: { nodes: SpecialtyDiagramNode[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: spacing.md,
      }}
    >
      {nodes.map((node) => (
        <article
          key={node.id ?? node.label}
          style={{
            border: `1px solid ${cockpitColors.panelBorder}`,
            borderRadius: radius.large,
            background: `linear-gradient(180deg, ${cockpitColors.panel} 0%, ${cockpitColors.accentMuted}33 100%)`,
            padding: spacing.md,
            display: "grid",
            gap: spacing.md,
            alignContent: "start",
          }}
        >
          <PhaseHeader node={node} stationPrefix />
          <PhaseBody node={node} denser />
        </article>
      ))}
    </div>
  );
}

function CardGrid({ nodes, fallbackBody }: { nodes: SpecialtyDiagramNode[]; fallbackBody?: string }) {
  if (!nodes.length && fallbackBody) {
    return (
      <pre
        style={{
          margin: 0,
          whiteSpace: "pre-wrap",
          fontFamily: "inherit",
          color: cockpitColors.textSecondary,
          lineHeight: 1.55,
          fontSize: typography.caption.fontSize,
        }}
      >
        {fallbackBody}
      </pre>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: spacing.md,
      }}
    >
      {nodes.map((node) => (
        <article
          key={node.id ?? node.label}
          style={{
            border: `1px solid ${cockpitColors.panelBorder}`,
            borderRadius: radius.large,
            padding: spacing.md,
            background: cockpitColors.panel,
            display: "grid",
            gap: spacing.md,
          }}
        >
          <PhaseHeader node={node} />
          <PhaseBody node={node} denser />
        </article>
      ))}
    </div>
  );
}

function PhaseHeader({ node, stationPrefix = false }: { node: SpecialtyDiagramNode; stationPrefix?: boolean }) {
  const title = stationPrefix
    ? `Station ${node.index}: ${node.label}`
    : `${node.index ? `${node.index}. ` : ""}${node.label}`;

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, color: cockpitColors.textPrimary, fontSize: typography.sectionTitle.fontSize }}>
          {title}
        </div>
        {node.durationLabel ? (
          <span
            style={{
              borderRadius: radius.pill,
              background: cockpitColors.accentMuted,
              color: cockpitColors.accent,
              padding: "4px 10px",
              fontSize: typography.caption.fontSize,
              fontWeight: 700,
            }}
          >
            {node.durationLabel}
          </span>
        ) : null}
      </div>
      {node.intent ? (
        <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>{node.intent}</div>
      ) : null}
    </div>
  );
}

function PhaseBody({ node, denser = false }: { node: SpecialtyDiagramNode; denser?: boolean }) {
  const activities = Array.isArray(node.activities) ? node.activities : [];
  if (activities.length) {
    return (
      <div style={{ display: "grid", gap: spacing.md }}>
        {activities.map((activity) => (
          <ActivityCard key={activity.id ?? activity.name} activity={activity} denser={denser} />
        ))}
      </div>
    );
  }

  return (
    <ul style={{ margin: 0, paddingLeft: 18, color: cockpitColors.textSecondary, lineHeight: 1.55 }}>
      {(node.details ?? []).map((detail) => (
        <li key={detail}>{detail}</li>
      ))}
    </ul>
  );
}

function ActivityCard({ activity, denser = false }: { activity: SpecialtyActivity; denser?: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: denser ? "1fr" : "minmax(180px, 240px) 1fr",
        gap: spacing.md,
        border: `1px solid ${cockpitColors.panelBorder}`,
        borderRadius: radius.large,
        background: cockpitColors.inset,
        padding: spacing.md,
        alignItems: "stretch",
      }}
    >
      <DrillLayoutPicture visual={activity.visual} label={activity.name} />
      <div style={{ display: "grid", gap: spacing.sm, minWidth: 0, alignContent: "start" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700, color: cockpitColors.textPrimary, lineHeight: 1.3, fontSize: "1.05rem" }}>
            {activity.name}
          </div>
          {activity.durationLabel ? (
            <span style={{ fontSize: typography.caption.fontSize, color: cockpitColors.accent, fontWeight: 700 }}>
              {activity.durationLabel}
            </span>
          ) : null}
        </div>
        {activity.setup ? (
          <div
            style={{
              fontSize: typography.caption.fontSize,
              color: cockpitColors.textSecondary,
              background: cockpitColors.panel,
              borderRadius: radius.medium,
              border: `1px solid ${cockpitColors.panelBorder}`,
              padding: "8px 10px",
              lineHeight: 1.45,
            }}
          >
            <strong style={{ color: cockpitColors.textPrimary }}>Setup / space: </strong>
            {activity.setup}
          </div>
        ) : null}
        {(activity.steps ?? []).length ? (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 700, fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>
              How to run it
            </div>
            <ol
              style={{
                margin: 0,
                paddingLeft: 18,
                color: cockpitColors.textSecondary,
                lineHeight: 1.55,
                fontSize: typography.caption.fontSize,
              }}
            >
              {(activity.steps ?? []).map((step, index) => (
                <li key={`${index}-${step}`}>{step}</li>
              ))}
            </ol>
          </div>
        ) : null}
        {(activity.citations ?? []).length ? (
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontWeight: 700, fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary }}>
              Citations
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: cockpitColors.textMuted, fontSize: typography.caption.fontSize, lineHeight: 1.5 }}>
              {(activity.citations ?? []).map((citation, index) => (
                <li key={`${citation.org}-${citation.url ?? citation.knowledgeDocId ?? index}`}>
                  {citation.url ? (
                    <a href={citation.url} target="_blank" rel="noreferrer" style={{ color: cockpitColors.accent, fontWeight: 600 }}>
                      {citation.org}{citation.title ? ` — ${citation.title}` : ""}
                    </a>
                  ) : (
                    <span>
                      {citation.org}{citation.title ? ` — ${citation.title}` : ""}
                      {citation.knowledgeDocId ? ` (Knowledge ${citation.knowledgeDocId})` : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Surface diagram picture for a drill layout — CSS/SVG primitives only. */
function DrillLayoutPicture({ visual, label }: { visual?: string | null; label?: string }) {
  const kind = String(visual ?? "station").toLowerCase();
  const caption = layoutCaption(kind);
  const shell: CSSProperties = {
    borderRadius: radius.medium,
    border: `1px solid ${cockpitColors.panelBorder}`,
    background: `linear-gradient(160deg, ${cockpitColors.panel} 0%, ${cockpitColors.accentMuted}55 100%)`,
    padding: 10,
    display: "grid",
    gap: 6,
    minHeight: 150,
  };

  return (
    <figure style={{ margin: 0, ...shell }} aria-label={label ? `${label} layout` : "Drill layout"}>
      <svg viewBox="0 0 220 140" width="100%" height="140" role="img">
        <rect x="4" y="4" width="212" height="132" rx="10" fill="#f7f5f0" stroke="rgba(28,25,23,0.12)" />
        {/* shared field boundary */}
        <rect x="18" y="18" width="184" height="104" rx="8" fill="none" stroke={cockpitColors.accent} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.45" />
        {kind === "loop" ? <LoopDiagram /> : null}
        {kind === "pair" ? <PairDiagram /> : null}
        {kind === "grid" ? <GridDiagram /> : null}
        {kind === "triangle" ? <TriangleDiagram /> : null}
        {kind === "compete" ? <CompeteDiagram /> : null}
        {kind === "arrow" ? <ArrowDiagram /> : null}
        {kind === "recover" ? <RecoverDiagram /> : null}
        {kind === "board" ? <BoardDiagram /> : null}
        {!["loop", "pair", "grid", "triangle", "compete", "arrow", "recover", "board"].includes(kind) ? (
          <StationDiagram />
        ) : null}
      </svg>
      <figcaption
        style={{
          margin: 0,
          textAlign: "center",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: cockpitColors.accent,
        }}
      >
        {caption}
      </figcaption>
    </figure>
  );
}

function layoutCaption(kind: string) {
  switch (kind) {
    case "loop":
      return "Loop path";
    case "pair":
      return "Partner lanes";
    case "grid":
      return "Ladder / grid";
    case "triangle":
      return "Triangle support";
    case "compete":
      return "Small-sided pitch";
    case "arrow":
      return "Transition lanes";
    case "recover":
      return "Recovery zone";
    case "board":
      return "Huddle board";
    default:
      return "Station layout";
  }
}

function Cone({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <polygon points={`${x},${y - 8} ${x - 6},${y + 6} ${x + 6},${y + 6}`} fill={cockpitColors.warning} />
      <circle cx={x} cy={y + 7} r="1.5" fill={cockpitColors.textMuted} />
    </g>
  );
}

function Player({ x, y, fill = cockpitColors.accent }: { x: number; y: number; fill?: string }) {
  return (
    <g>
      <circle cx={x} cy={y - 5} r="4.5" fill={fill} />
      <rect x={x - 5} y={y} width="10" height="11" rx="3" fill={fill} />
    </g>
  );
}

function LoopDiagram() {
  return (
    <g>
      <ellipse cx="110" cy="70" rx="60" ry="34" fill="none" stroke={cockpitColors.accent} strokeWidth="3" />
      <Cone x={50} y={70} />
      <Cone x={170} y={70} />
      <Cone x={110} y={36} />
      <Cone x={110} y={104} />
      <Player x={78} y={48} />
      <Player x={145} y={88} />
      <path d="M160 48 Q180 70 160 92" fill="none" stroke={cockpitColors.accent} strokeWidth="2" markerEnd="url(#arrow)" />
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={cockpitColors.accent} />
        </marker>
      </defs>
    </g>
  );
}

function PairDiagram() {
  return (
    <g>
      <Player x={70} y={55} />
      <Player x={150} y={55} fill="#0d9488" />
      <Player x={70} y={100} />
      <Player x={150} y={100} fill="#0d9488" />
      <line x1="82" y1="58" x2="138" y2="58" stroke={cockpitColors.accent} strokeWidth="2" strokeDasharray="3 3" />
      <line x1="82" y1="103" x2="138" y2="103" stroke={cockpitColors.accent} strokeWidth="2" strokeDasharray="3 3" />
      <Cone x={110} y={38} />
      <Cone x={110} y={118} />
    </g>
  );
}

function GridDiagram() {
  const cells = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      cells.push(
        <rect
          key={`${row}-${col}`}
          x={55 + col * 18}
          y={40 + row * 16}
          width="14"
          height="12"
          rx="2"
          fill={row % 2 === col % 2 ? cockpitColors.accentMuted : "#fff"}
          stroke={cockpitColors.accent}
          strokeWidth="1"
        />,
      );
    }
  }
  return (
    <g>
      {cells}
      <Player x={40} y={72} />
      <path d="M48 78 H160" stroke={cockpitColors.accent} strokeWidth="2" markerEnd="url(#arrow2)" />
      <defs>
        <marker id="arrow2" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={cockpitColors.accent} />
        </marker>
      </defs>
    </g>
  );
}

function TriangleDiagram() {
  return (
    <g>
      <polygon points="110,36 60,108 160,108" fill="none" stroke={cockpitColors.accent} strokeWidth="2.5" />
      <Cone x={110} y={36} />
      <Cone x={60} y={108} />
      <Cone x={160} y={108} />
      <Player x={110} y={58} />
      <Player x={82} y={95} />
      <Player x={138} y={95} />
    </g>
  );
}

function CompeteDiagram() {
  return (
    <g>
      <rect x="28" y="30" width="14" height="80" rx="2" fill={cockpitColors.accent} opacity="0.25" stroke={cockpitColors.accent} />
      <rect x="178" y="30" width="14" height="80" rx="2" fill={cockpitColors.accent} opacity="0.25" stroke={cockpitColors.accent} />
      <line x1="110" y1="22" x2="110" y2="118" stroke={cockpitColors.accent} strokeWidth="1.5" strokeDasharray="3 4" />
      <Player x={70} y={55} />
      <Player x={85} y={95} />
      <Player x={55} y={85} />
      <Player x={145} y={55} fill="#b45309" />
      <Player x={160} y={90} fill="#b45309" />
      <Player x={135} y={100} fill="#b45309" />
      <circle cx="110" cy="72" r="5" fill="#fff" stroke={cockpitColors.accent} strokeWidth="2" />
    </g>
  );
}

function ArrowDiagram() {
  return (
    <g>
      <Cone x={40} y={70} />
      <Cone x={110} y={70} />
      <Cone x={180} y={70} />
      <Player x={55} y={70} />
      <Player x={125} y={55} />
      <Player x={165} y={90} />
      <path d="M50 50 H175" fill="none" stroke={cockpitColors.accent} strokeWidth="3" markerEnd="url(#arrow3)" />
      <path d="M50 95 H150" fill="none" stroke={cockpitColors.accent} strokeWidth="2" opacity="0.5" markerEnd="url(#arrow3)" />
      <defs>
        <marker id="arrow3" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill={cockpitColors.accent} />
        </marker>
      </defs>
    </g>
  );
}

function RecoverDiagram() {
  return (
    <g>
      <ellipse cx="110" cy="72" rx="55" ry="32" fill={cockpitColors.accentMuted} stroke={cockpitColors.accent} strokeWidth="2" />
      <Player x={95} y={72} />
      <Player x={125} y={72} />
      <text x="110" y="48" textAnchor="middle" fontSize="11" fill={cockpitColors.accent} fontWeight="700">
        walk / breathe
      </text>
    </g>
  );
}

function BoardDiagram() {
  return (
    <g>
      <rect x="55" y="28" width="110" height="70" rx="6" fill="#1c1917" />
      <line x1="68" y1="48" x2="152" y2="48" stroke="#a8a29e" strokeWidth="3" />
      <line x1="68" y1="62" x2="140" y2="62" stroke="#78716c" strokeWidth="3" />
      <line x1="68" y1="76" x2="128" y2="76" stroke="#57534e" strokeWidth="3" />
      <Player x={80} y={115} />
      <Player x={110} y={115} />
      <Player x={140} y={115} />
    </g>
  );
}

function StationDiagram() {
  return (
    <g>
      <rect x="28" y="34" width="50" height="72" rx="8" fill="#fff" stroke={cockpitColors.accent} strokeWidth="2" />
      <rect x="85" y="34" width="50" height="72" rx="8" fill="#fff" stroke={cockpitColors.accent} strokeWidth="2" />
      <rect x="142" y="34" width="50" height="72" rx="8" fill="#fff" stroke={cockpitColors.accent} strokeWidth="2" />
      <text x="53" y="74" textAnchor="middle" fontSize="16" fontWeight="700" fill={cockpitColors.accent}>A</text>
      <text x="110" y="74" textAnchor="middle" fontSize="16" fontWeight="700" fill={cockpitColors.accent}>B</text>
      <text x="167" y="74" textAnchor="middle" fontSize="16" fontWeight="700" fill={cockpitColors.accent}>C</text>
      <Player x={53} y={115} />
      <Player x={110} y={115} />
      <Player x={167} y={115} />
    </g>
  );
}
