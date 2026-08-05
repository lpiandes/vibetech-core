/**
 * VibeTech ROI assessment — 4 questions → rate-card package + BLS wage math.
 *
 * teamSize → affected headcount (band midpoints)
 * orgType → results wording only
 * pain → package + hours-lost-per-person/week + research citation
 * currentState → recoverable % of the labor-cost problem
 *
 * monthlyGross = headcount × hoursLost × 4.33 × $20.59
 * monthlyRecoverable = monthlyGross × recoveryPct
 * Compared to published rate-card setup + monthly.
 */
(function () {
  const STORAGE_KEY = "vt.roi.assessment.v2";
  const BLS_WAGE = 20.59;
  const WEEKS_PER_MONTH = 4.33;

  const MEETING_MAIL =
    "mailto:leopiandes@vtechdevelopment.com,brettbaldassare@vtechdevelopment.com,carynorthrop@vtechdevelopment.com" +
    "?subject=" +
    encodeURIComponent("Meeting request — ROI assessment");

  /** Published rate card (floor prices). */
  const PACKAGES = {
    process_review: {
      id: "process_review",
      name: "Business Process Review",
      category: "Discovery & Consulting",
      setup: 3500,
      monthly: 0,
      blurb: "Map where time and revenue leak before you buy the wrong stack.",
    },
    ai_strategy: {
      id: "ai_strategy",
      name: "AI Strategy and Roadmap",
      category: "Discovery & Consulting",
      setup: 5000,
      monthly: 0,
      blurb: "Executive roadmap so complex teams don’t fund the wrong pilots.",
    },
    ai_receptionist: {
      id: "ai_receptionist",
      name: "AI Receptionist",
      category: "AI Voice & Communication",
      setup: 4000,
      monthly: 997,
      blurb: "Answer inbound calls, capture notes, keep bookings from falling through.",
    },
    lead_follow_up: {
      id: "lead_follow_up",
      name: "Automated Lead Follow-Up",
      category: "Sales & Marketing",
      setup: 3500,
      monthly: 797,
      blurb: "Chase leads fast so warm interest doesn’t go cold.",
    },
    workflow_automation: {
      id: "workflow_automation",
      name: "Workflow Automation",
      category: "Customer Service & Operations",
      setup: 3000,
      monthly: 697,
      blurb: "Remove repetitive handoffs so teams leave the spreadsheet grind.",
    },
    essential_managed: {
      id: "essential_managed",
      name: "Essential (Managed)",
      category: "Managed Services",
      setup: 3500,
      monthly: 997,
      blurb: "We run a focused AI worker set with you — setup isn’t the finish line.",
    },
    growth_managed: {
      id: "growth_managed",
      name: "Growth (Managed)",
      category: "Managed Services",
      setup: 7500,
      monthly: 1997,
      blurb: "Broader managed automation for teams that need more coverage.",
    },
  };

  /** Midpoints for each team-size band (documented). */
  const TEAM = {
    solo: { label: "Just me or 1–5 people", headcount: 3 },
    small: { label: "6–20 people", headcount: 12 },
    mid: { label: "21–75 people", headcount: 40 },
    large: { label: "75+ people", headcount: 90 },
  };

  const ORG = {
    insurance: {
      label: "Insurance / financial services",
      hypothetical: "an insurance or financial-services team where leads and quotes can’t wait",
    },
    field: {
      label: "Home & field services",
      hypothetical: "an appointment-driven field business juggling calls, jobs, and follow-up",
    },
    professional: {
      label: "Professional / consulting services",
      hypothetical: "a professional services firm where partner time is the scarce resource",
    },
    retail: {
      label: "Retail, e-commerce & hospitality",
      hypothetical: "a customer-facing retail or hospitality team balancing volume and experience",
    },
    enterprise: {
      label: "Enterprise or government organization",
      hypothetical: "a larger organization where handoffs cross teams, tools, and approvals",
    },
  };

  /**
   * Pain → package + hours lost per person per week + research backing the estimate.
   */
  const PAIN = {
    leads: {
      label: "Inquiries going cold — slow or missed follow-up",
      packageId: "lead_follow_up",
      hoursLostPerPersonWeek: 6,
      researchTitle: "21× more likely to qualify a lead within 5 minutes",
      researchDetail:
        "A MIT / InsideSales.com study of 100,000+ contact attempts found businesses contacting a lead within 5 minutes are 21 times more likely to qualify that lead than those who wait 30 minutes. HBR found the average firm takes 42 hours to respond.",
      researchSource: "MIT Lead Response Management Study; Harvard Business Review, 2011",
    },
    phones: {
      label: "Phones and scheduling — missed calls, booking chaos",
      packageId: "ai_receptionist",
      hoursLostPerPersonWeek: 8,
      researchTitle: "Up to 16 hours saved per employee per week with automation",
      researchDetail:
        "Zapier’s State of Business Automation report found customer service reps who automate follow-up and status work save an average of 16 hours a week; sales pros save about 6.",
      researchSource: "Zapier, State of Business Automation Report",
    },
    ops: {
      label: "Manual busywork — stuck in spreadsheets, disconnected tools",
      packageId: "workflow_automation",
      hoursLostPerPersonWeek: 7,
      researchTitle: "60% of the workday lost to “work about work”",
      researchDetail:
        "Asana’s Anatomy of Work Index found knowledge workers spend about 60% of time searching, switching tools, and chasing status — not the job they were hired to do. HBR estimated ~9% of the work year lost to app switching alone.",
      researchSource: "Asana Anatomy of Work; Harvard Business Review, 2022",
    },
    strategy: {
      label: "No clear plan — need someone to run AI strategy for us",
      packageId: "ai_strategy",
      hoursLostPerPersonWeek: 4,
      researchTitle: "95% of generic AI pilots show no measurable return",
      researchDetail:
        "MIT NANDA’s 2025 GenAI Divide study found 95% of generative AI pilots delivered no measurable financial impact — often because rigid, one-size-fits-all systems didn’t fit how the business works. Partnering on tailored builds succeeded roughly twice as often as DIY.",
      researchSource: "MIT NANDA, The GenAI Divide: State of AI in Business 2025",
    },
  };

  /** Current state → recoverable share of the modeled labor cost. */
  const STATE = {
    manual: {
      label: "All manual — people-powered, no systems in place",
      recoveryPct: 0.7,
      twist: "Almost every recovery has to come from changing how people spend their hours.",
    },
    tools: {
      label: "Scattered tools — a mix of software, nothing talking to each other",
      recoveryPct: 0.55,
      twist: "You already pay for software; the leak is the glue work between tools.",
    },
    tried_ai: {
      label: "Tried AI already — it didn’t stick or deliver",
      recoveryPct: 0.45,
      twist: "You’ve spent on AI once — the case has to include not repeating a dead pilot.",
    },
    figuring: {
      label: "Still figuring it out — no real process yet",
      recoveryPct: 0.35,
      twist: "The biggest cost isn’t today’s leak alone — it’s buying the wrong thing next.",
    },
  };

  const QUESTIONS = [
    {
      id: "team",
      prompt: "How big is your team?",
      options: Object.keys(TEAM).map((value) => ({ value, label: TEAM[value].label })),
    },
    {
      id: "org",
      prompt: "What kind of organization are you?",
      options: Object.keys(ORG).map((value) => ({ value, label: ORG[value].label })),
    },
    {
      id: "pain",
      prompt: "Where are you losing the most time or money?",
      options: Object.keys(PAIN).map((value) => ({ value, label: PAIN[value].label })),
    },
    {
      id: "state",
      prompt: "How do you handle this today?",
      options: Object.keys(STATE).map((value) => ({ value, label: STATE[value].label })),
    },
  ];

  const ui = {
    step: 0,
    answers: {},
  };

  function money(n) {
    const rounded = Math.round(n);
    const sign = rounded < 0 ? "-" : "";
    return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
  }

  function pct(n) {
    return `${Math.round(n)}%`;
  }

  function pickPackageId() {
    const painKey = ui.answers.pain?.value || "leads";
    const team = ui.answers.team?.value;
    const state = ui.answers.state?.value;
    const pain = PAIN[painKey] || PAIN.leads;

    if (state === "tried_ai" && (painKey === "leads" || painKey === "phones" || painKey === "ops")) {
      return team === "large" || team === "mid" ? "growth_managed" : "essential_managed";
    }
    if (painKey === "strategy") {
      return team === "large" || team === "mid" ? "ai_strategy" : "process_review";
    }
    return pain.packageId;
  }

  function computeRoi() {
    const team = TEAM[ui.answers.team?.value] || TEAM.solo;
    const org = ORG[ui.answers.org?.value] || ORG.professional;
    const pain = PAIN[ui.answers.pain?.value] || PAIN.leads;
    const cur = STATE[ui.answers.state?.value] || STATE.manual;
    const packageId = pickPackageId();
    const pkg = PACKAGES[packageId] || PACKAGES.lead_follow_up;

    const hoursTeamWeek = team.headcount * pain.hoursLostPerPersonWeek;
    const monthlyGross = Math.round(hoursTeamWeek * WEEKS_PER_MONTH * BLS_WAGE);
    const monthlyRecoverable = Math.round(monthlyGross * cur.recoveryPct);
    const year1Recoverable = monthlyRecoverable * 12;
    const year1VibeTech = pkg.setup + pkg.monthly * 12;
    const effectiveMonthly = Math.round(year1VibeTech / 12);
    const netMonthly = monthlyRecoverable - effectiveMonthly;
    const year1Net = year1Recoverable - year1VibeTech;
    const roiPct = year1VibeTech > 0 ? (year1Net / year1VibeTech) * 100 : 0;

    let payback = null;
    if (monthlyRecoverable > pkg.monthly) {
      payback = Math.ceil(pkg.setup / (monthlyRecoverable - pkg.monthly));
    } else if (monthlyRecoverable > 0 && pkg.monthly === 0) {
      payback = Math.ceil(pkg.setup / monthlyRecoverable);
    }

    return {
      pkg,
      team,
      org,
      pain,
      cur,
      hoursTeamWeek,
      monthlyGross,
      monthlyRecoverable,
      year1Recoverable,
      year1VibeTech,
      effectiveMonthly,
      netMonthly,
      year1Net,
      roiPct,
      payback,
      blsWage: BLS_WAGE,
    };
  }

  function persist(result) {
    try {
      const payload = {
        version: 2,
        answeredAt: new Date().toISOString(),
        answers: {
          team: ui.answers.team?.value,
          org: ui.answers.org?.value,
          pain: ui.answers.pain?.value,
          state: ui.answers.state?.value,
        },
        labels: {
          team: ui.answers.team?.label,
          org: ui.answers.org?.label,
          pain: ui.answers.pain?.label,
          state: ui.answers.state?.label,
        },
        recommendation: {
          packageId: result.pkg.id,
          packageName: result.pkg.name,
          setup: result.pkg.setup,
          monthly: result.pkg.monthly,
        },
        math: {
          headcount: result.team.headcount,
          hoursTeamWeek: result.hoursTeamWeek,
          blsWage: result.blsWage,
          recoveryPct: result.cur.recoveryPct,
          monthlyGross: result.monthlyGross,
          monthlyRecoverable: result.monthlyRecoverable,
          netMonthly: result.netMonthly,
          year1Net: result.year1Net,
          roiPct: Math.round(result.roiPct),
          paybackMonths: result.payback,
        },
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      window.VIBETECH_ROI_ASSESSMENT = payload;
    } catch {
      /* ignore private mode */
    }
  }

  function root() {
    return document.getElementById("roi-qualifier");
  }

  function renderQuestion() {
    const el = root();
    if (!el) return;
    const q = QUESTIONS[ui.step];
    el.innerHTML = `
      <div class="rq-card">
        <div class="rq-progress" aria-hidden="true">
          ${QUESTIONS.map((_, i) => `<span class="${i <= ui.step ? "on" : ""}"></span>`).join("")}
        </div>
        <p class="rq-step">Question ${ui.step + 1} of ${QUESTIONS.length}</p>
        <h3 class="rq-prompt">${q.prompt}</h3>
        <div class="rq-options" role="group" aria-label="${q.prompt}">
          ${q.options
            .map(
              (opt) => `
            <button type="button" class="rq-option" data-value="${opt.value}">
              ${opt.label}
            </button>`,
            )
            .join("")}
        </div>
      </div>
    `;
    el.querySelectorAll(".rq-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        const opt = q.options.find((o) => o.value === btn.getAttribute("data-value"));
        ui.answers[q.id] = opt;
        ui.step += 1;
        if (ui.step >= QUESTIONS.length) renderResult();
        else renderQuestion();
      });
    });
  }

  function priceLine(pkg) {
    if (pkg.monthly <= 0) {
      return `<strong>${money(pkg.setup)}</strong><span> one-time</span>`;
    }
    return `<strong>${money(pkg.monthly)}</strong><span>/mo</span> · setup <strong>${money(pkg.setup)}</strong>`;
  }

  function meetingHref(r) {
    const body = [
      "Hi VibeTech,",
      "",
      "I'd like to request a meeting after the ROI assessment.",
      "",
      `Team: ${ui.answers.team?.label}`,
      `Org: ${ui.answers.org?.label}`,
      `Pain: ${ui.answers.pain?.label}`,
      `Today: ${ui.answers.state?.label}`,
      `Recommended: ${r.pkg.name}`,
      `Modeled recoverable: ${money(r.monthlyRecoverable)}/mo`,
      `Year-one net (modeled): ${money(r.year1Net)}`,
      "",
      "Preferred times:",
      "",
    ].join("\n");
    return `${MEETING_MAIL}&body=${encodeURIComponent(body)}`;
  }

  function renderResult() {
    const el = root();
    if (!el) return;
    const r = computeRoi();
    persist(r);
    const netClass = r.netMonthly >= 0 ? "rq-upside" : "rq-caution";
    const yearClass = r.year1Net >= 0 ? "rq-upside" : "rq-caution";
    const paybackLine =
      r.payback != null
        ? `At this recovery rate, setup pays back in about <strong>${r.payback} month${r.payback === 1 ? "" : "s"}</strong> (after covering the monthly fee).`
        : `Monthly recovery is close to the monthly fee — treat this as a capacity play and tighten scope on a call.`;

    el.innerHTML = `
      <div class="rq-card rq-result">
        <p class="rq-step">Your modeled estimate · ${r.pkg.category}</p>
        <p class="rq-path">
          Based on: <strong>${ui.answers.team?.label}</strong>
          → <strong>${ui.answers.org?.label}</strong>
          → <strong>${ui.answers.pain?.label}</strong>
          → <strong>${ui.answers.state?.label}</strong>
        </p>
        <h3 class="rq-prompt">Recommended starting point</h3>
        <div class="rq-rec">
          <div>
            <p class="rq-rec-name">${r.pkg.name}</p>
            <p class="rq-rec-blurb">${r.pkg.blurb}</p>
            <p class="rq-fit">
              Fits because you’re dealing with ${r.pain.label.toLowerCase()}, and today that’s
              ${r.cur.label.toLowerCase()}. Picture ${r.org.hypothetical}.
            </p>
            <p class="rq-rec-price">${priceLine(r.pkg)}</p>
          </div>
          <div class="rq-metrics">
            <div>
              <span class="rq-label">Modeled cost of the problem</span>
              <strong>${money(r.monthlyGross)}<span class="rq-unit">/mo</span></strong>
            </div>
            <div class="rq-upside">
              <span class="rq-label">Recoverable at ${pct(r.cur.recoveryPct * 100)}</span>
              <strong>${money(r.monthlyRecoverable)}<span class="rq-unit">/mo</span></strong>
            </div>
            <div class="${netClass}">
              <span class="rq-label">Net vs effective VibeTech price</span>
              <strong>${r.netMonthly >= 0 ? "+" : ""}${money(r.netMonthly)}<span class="rq-unit">/mo</span></strong>
            </div>
            <div class="${yearClass}">
              <span class="rq-label">Year-one ROI</span>
              <strong>${r.year1Net >= 0 ? "+" : ""}${money(r.year1Net)}<span class="rq-unit"> · ${pct(r.roiPct)}</span></strong>
            </div>
          </div>
        </div>

        <div class="rq-compare">
          <div>
            <span class="rq-label">Year-one VibeTech</span>
            <strong>${money(r.year1VibeTech)}</strong>
          </div>
          <div>
            <span class="rq-label">Year-one recoverable</span>
            <strong>${money(r.year1Recoverable)}</strong>
          </div>
          <div>
            <span class="rq-label">Payback</span>
            <strong>${r.payback != null ? `~${r.payback} mo` : "Call"}</strong>
          </div>
        </div>

        <div class="rq-why">
          <p class="rq-why-title">How the math works</p>
          <div class="rq-explain-block">
            <p class="rq-explain-title">1. Affected headcount × hours lost</p>
            <p class="rq-explain-body">
              We treat your team band as about <strong>${r.team.headcount} people</strong> affected,
              losing about <strong>${r.pain.hoursLostPerPersonWeek} hours/person/week</strong>
              (<strong>${r.hoursTeamWeek} hours/week</strong> total) on this problem —
              informed by: <em>${r.pain.researchTitle}</em>. ${r.pain.researchDetail}
              <span class="rq-cite">Source: ${r.pain.researchSource}</span>
            </p>
          </div>
          <div class="rq-explain-block">
            <p class="rq-explain-title">2. Convert to dollars (BLS median wage)</p>
            <p class="rq-explain-body">
              ${r.hoursTeamWeek} hrs/week × ${WEEKS_PER_MONTH} weeks ×
              <strong>$${BLS_WAGE.toFixed(2)}/hr</strong> (BLS median wage) =
              <strong>${money(r.monthlyGross)}/mo</strong> gross cost of the problem.
            </p>
          </div>
          <div class="rq-explain-block">
            <p class="rq-explain-title">3. Apply a realistic recovery rate</p>
            <p class="rq-explain-body">
              Because you’re <strong>${r.cur.label.toLowerCase()}</strong>, we model reclaiming
              <strong>${pct(r.cur.recoveryPct * 100)}</strong> —
              <strong>${money(r.monthlyRecoverable)}/mo</strong>. ${r.cur.twist}
            </p>
          </div>
          <div class="rq-explain-block">
            <p class="rq-explain-title">4. Compare to the published rate card</p>
            <p class="rq-explain-body">
              ${
                r.pkg.monthly > 0
                  ? `<strong>${r.pkg.name}</strong> is <strong>${money(r.pkg.setup)} setup</strong> +
                     <strong>${money(r.pkg.monthly)}/mo</strong> (~${money(r.effectiveMonthly)}/mo
                     when setup is spread over year one; <strong>${money(r.year1VibeTech)}</strong> year-one total).`
                  : `<strong>${r.pkg.name}</strong> is a <strong>${money(r.pkg.setup)} one-time</strong>
                     engagement (~${money(r.effectiveMonthly)}/mo if spread across a year).`
              }
              Year-one net is <strong>${money(r.year1Net)}</strong>
              (<strong>${pct(r.roiPct)}</strong> on year-one VibeTech spend). ${paybackLine}
            </p>
          </div>
        </div>

        <p class="rq-note">
          This is a <strong>modeled estimate</strong> based on named research, BLS wage assumptions,
          and your answers — not a guaranteed result or formal quote. A conversation locks real scope and volume.
        </p>
        <div class="rq-actions">
          <button type="button" class="btn btn-primary" id="rq-build-plan" data-vt-open-consultant="plan">
            Build my AI plan
          </button>
          <a class="btn rq-ghost" href="${meetingHref(r)}">Request a meeting</a>
          <button type="button" class="btn rq-ghost" id="rq-restart">Start over</button>
        </div>
      </div>
    `;

    el.querySelector("#rq-restart")?.addEventListener("click", () => {
      ui.step = 0;
      ui.answers = {};
      renderQuestion();
    });
    el.querySelector("#rq-build-plan")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("vt:open-consultant", { detail: { mode: "plan" } }));
    });
  }

  function init() {
    if (!root()) return;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) window.VIBETECH_ROI_ASSESSMENT = JSON.parse(saved);
    } catch {
      /* ignore */
    }
    renderQuestion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
