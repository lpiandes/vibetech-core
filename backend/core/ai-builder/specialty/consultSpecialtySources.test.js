import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveMatchingAuthorityPacks,
  scoreAuthorityPack,
  SPECIALTY_AUTHORITY_PACKS,
} from "./SpecialtyAuthorityRegistry.js";
import {
  consultSpecialtySources,
  extractActivitiesFromSources,
} from "./consultSpecialtySources.js";
import {
  composeSpecialtyArtifact,
  hydrateSpecialtyArtifact,
} from "./SpecialtyArtifactComposer.js";

const USA_HOCKEY_FIXTURE = `
Practice Plans
Here is a collection of age-specific USA Hockey practice plans designed for high-performance player development.
Warm-up: Dynamic skating edges. Players loop the ice with open-hip strides inside then outside edges.
Skill Station A: Technique under time. Two lanes with rebounder. Perfect form at 70 percent then add pace.
Skill Station B: Decision reps. Three options marked left middle right. Coach points a lane; player chooses in one second.
Small-area Games: Cross-ice 3v3 scored. Thirty to forty-five second shifts. Must touch three players before a shot.
Cool-down: Easy movement and hydrate then 3-question debrief on what worked, what broke, and what to keep.
`;

describe("SpecialtyAuthorityRegistry", () => {
  it("matches domain authorities by brief (hockey vs baseball) and not unrelated industries", () => {
    const hockey = resolveMatchingAuthorityPacks({
      label: "Practice & Workout Plan Builder",
      purpose: "create daily workout and practice plans",
      instruction: "Build Friday hockey practice plan for U14 skating edges",
    });
    assert.ok(hockey.some((entry) => entry.pack.id === "usa_hockey_adm"));
    assert.equal(hockey[0].pack.domain, "hockey");

    const baseball = resolveMatchingAuthorityPacks({
      label: "Practice & Workout Plan Builder",
      purpose: "create practice plans",
      instruction: "Build Saturday baseball practice with pitching and infield work",
    });
    assert.ok(baseball.some((entry) => entry.pack.id === "usa_baseball_coach"));
    assert.ok(!baseball.some((entry) => entry.pack.domain === "hockey"));

    const property = resolveMatchingAuthorityPacks({
      label: "Compliance Specialist",
      purpose: "Run property walkthroughs",
      instruction: "Build an inspection checklist for unit 4B",
    });
    assert.equal(property.length, 0);

    const usaHockey = SPECIALTY_AUTHORITY_PACKS.find((pack) => pack.id === "usa_hockey_adm");
    const scored = scoreAuthorityPack(usaHockey, {
      instruction: "generic friday practice for U14",
    });
    assert.equal(scored.matchScore, 0);
  });
});

describe("consultSpecialtySources", () => {
  it("prefers USA Hockey pack excerpts over weaker Knowledge when both exist", async () => {
    const consult = await consultSpecialtySources({
      label: "Practice & Workout Plan Builder",
      purpose: "create daily workout and practice plans for youth hockey",
      instruction: "Build Friday hockey practice plan for U14",
      businessId: "biz_1",
      knowledgeDocuments: [{
        id: "doc_notes",
        businessId: "biz_1",
        status: "ready",
        title: "Team notes",
        contentText: "Remember pucks and water bottles.",
        categoryIds: [],
      }],
      packFixtures: {
        "https://www.usahockey.com/practiceplans": USA_HOCKEY_FIXTURE,
      },
      nowISO: "2026-07-01T12:00:00.000Z",
    });

    assert.ok(consult.sources.length >= 1);
    assert.equal(consult.preferred.provenance, "authority_pack");
    assert.equal(consult.preferred.org, "USA Hockey");
    assert.match(consult.preferred.excerpt, /Practice Plans|Warm-up|Station/i);
    assert.equal(consult.gaps.length, 0);
  });

  it("returns missing_curriculum_sources when nothing usable is available", async () => {
    const consult = await consultSpecialtySources({
      label: "Practice & Workout Plan Builder",
      purpose: "create daily workout and practice plans",
      instruction: "Build Friday practice plan for U14",
      businessId: "biz_1",
      knowledgeDocuments: [],
      nowISO: "2026-07-01T12:00:00.000Z",
    });
    assert.equal(consult.sources.length, 0);
    assert.ok(consult.gaps.some((gap) => gap.code === "missing_curriculum_sources"));
  });
});

describe("SpecialtyArtifactComposer consulted content", () => {
  it("does not invent named drills when sources are empty", () => {
    const artifact = composeSpecialtyArtifact({
      label: "Practice & Workout Plan Builder",
      purpose: "create daily workout and practice plans",
      instruction: "Build Friday practice plan for U14",
      nowISO: "2026-07-01T12:00:00.000Z",
      consultResult: {
        sources: [],
        gaps: [{ code: "missing_curriculum_sources", message: "No sources" }],
        packMatches: [],
        preferred: null,
        consultedAt: "2026-07-01T12:00:00.000Z",
      },
    });

    assert.equal(artifact.templateId, "session_flow");
    assert.ok(artifact.gaps?.length);
    const names = artifact.diagram.nodes.flatMap((node) => (node.activities ?? []).map((a) => a.name));
    assert.equal(names.length, 0);
    assert.ok(!names.some((name) => /Station A|3v3|Activation ladder/i.test(String(name))));
  });

  it("builds cited activities from USA Hockey excerpts", () => {
    const sources = [{
      id: "pack_usa_1",
      org: "USA Hockey",
      title: "USA Hockey ADM / Practice Plans",
      url: "https://www.usahockey.com/practiceplans",
      knowledgeDocId: null,
      provenance: "authority_pack",
      packId: "usa_hockey_adm",
      authorityScore: 95,
      excerpt: USA_HOCKEY_FIXTURE,
    }];
    const activities = extractActivitiesFromSources(sources);
    assert.ok(activities.length >= 1);

    const artifact = composeSpecialtyArtifact({
      label: "Practice & Workout Plan Builder",
      purpose: "create daily workout and practice plans for youth hockey",
      instruction: "Build Friday hockey practice plan for U14",
      nowISO: "2026-07-01T12:00:00.000Z",
      sources,
      consultResult: {
        sources,
        gaps: [],
        packMatches: [{ packId: "usa_hockey_adm", org: "USA Hockey", matchScore: 2, rankScore: 190 }],
        preferred: sources[0],
        consultedAt: "2026-07-01T12:00:00.000Z",
      },
    });

    const cited = artifact.diagram.nodes.flatMap((node) => node.activities ?? []);
    assert.ok(cited.length >= 1);
    assert.ok(cited.every((activity) => (activity.citations ?? []).some((c) => c.org === "USA Hockey")));
    assert.match(artifact.body, /Source: USA Hockey/);
  });

  it("hydrates uncited invented outlines into a gap instead of keeping fake drills", () => {
    const outline = {
      kind: "specialty_deliverable",
      templateId: "session_flow",
      title: "Friday plan — U14",
      diagram: {
        layout: "timeline",
        header: { title: "Friday plan — U14", subtitle: "Build Friday practice plan for U14" },
        nodes: [{
          id: "focus",
          label: "Skill stations",
          activities: [{ name: "Station A — made up", steps: ["Invented"], citations: [] }],
        }],
      },
    };
    const hydrated = hydrateSpecialtyArtifact({
      artifact: outline,
      label: "Practice & Workout Plan Builder",
      purpose: "create daily workout and practice plans",
      instruction: "Build Friday practice plan for U14",
      nowISO: "2026-07-01T12:00:00.000Z",
      sources: [],
    });
    const names = hydrated.diagram.nodes.flatMap((node) => (node.activities ?? []).map((a) => a.name));
    assert.ok(!names.includes("Station A — made up"));
    assert.ok(hydrated.gaps?.length);
  });
});
