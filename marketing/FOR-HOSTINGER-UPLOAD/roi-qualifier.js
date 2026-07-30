/**
 * VibeTech ROI qualifier — published price sheet vs industry-average status-quo cost.
 * Every business × leak × today path maps to a distinct package, math, and narrative.
 */
(function () {
  const BOOK_CALL_URL =
    (typeof window !== "undefined" && window.VIBETECH_BOOK_CALL_URL) ||
    "mailto:leopiandes@vtechdevelopment.com?subject=Book%20a%20call%20%E2%80%94%20ROI%20check";

  /** Published rate card (floor prices). */
  const PACKAGES = {
    process_review: {
      id: "process_review",
      name: "Business Process Review",
      category: "Discovery & Consulting",
      setup: 3500,
      monthly: 0,
      blurb: "Map where time and revenue leak before you buy the wrong stack.",
      hoursSavedPerWeek: 4,
      capture: 0.35,
      statusQuoKey: "discovery",
    },
    ai_strategy: {
      id: "ai_strategy",
      name: "AI Strategy and Roadmap",
      category: "Discovery & Consulting",
      setup: 5000,
      monthly: 0,
      blurb: "Executive roadmap so complex teams don’t fund the wrong pilots.",
      hoursSavedPerWeek: 6,
      capture: 0.4,
      statusQuoKey: "discovery",
    },
    ai_receptionist: {
      id: "ai_receptionist",
      name: "AI Receptionist",
      category: "AI Voice & Communication",
      setup: 4000,
      monthly: 997,
      blurb: "Answer inbound calls, capture notes, keep bookings from falling through.",
      hoursSavedPerWeek: 18,
      capture: 0.62,
      statusQuoKey: "phones",
    },
    ai_inbound: {
      id: "ai_inbound",
      name: "AI Inbound Call Agent",
      category: "AI Voice & Communication",
      setup: 5000,
      monthly: 1497,
      blurb: "Heavier inbound volume with structured answers and handoffs.",
      hoursSavedPerWeek: 25,
      capture: 0.65,
      statusQuoKey: "phones",
    },
    appointment_scheduling: {
      id: "appointment_scheduling",
      name: "Appointment Scheduling Agent",
      category: "AI Voice & Communication",
      setup: 4500,
      monthly: 1297,
      blurb: "Book, confirm, and cut no-shows without a full-time scheduler.",
      hoursSavedPerWeek: 16,
      capture: 0.6,
      statusQuoKey: "phones",
    },
    lead_follow_up: {
      id: "lead_follow_up",
      name: "Automated Lead Follow-Up",
      category: "Sales & Marketing",
      setup: 3500,
      monthly: 797,
      blurb: "Chase leads fast so warm interest doesn’t go cold.",
      hoursSavedPerWeek: 12,
      capture: 0.68,
      statusQuoKey: "leads",
    },
    lead_qualification: {
      id: "lead_qualification",
      name: "AI Lead Qualification System",
      category: "Sales & Marketing",
      setup: 4000,
      monthly: 997,
      blurb: "Score and route inbound so sales only talks to real opportunities.",
      hoursSavedPerWeek: 14,
      capture: 0.7,
      statusQuoKey: "leads",
    },
    crm_automation: {
      id: "crm_automation",
      name: "CRM Automation",
      category: "Sales & Marketing",
      setup: 6000,
      monthly: 1497,
      blurb: "Pipeline hygiene and stage-triggered follow-through.",
      hoursSavedPerWeek: 15,
      capture: 0.58,
      statusQuoKey: "ops",
    },
    email_marketing: {
      id: "email_marketing",
      name: "Email Marketing Automation",
      category: "Sales & Marketing",
      setup: 4000,
      monthly: 997,
      blurb: "Nurture sequences without daily manual sends.",
      hoursSavedPerWeek: 10,
      capture: 0.55,
      statusQuoKey: "leads",
    },
    website_chatbot: {
      id: "website_chatbot",
      name: "Website Chatbot",
      category: "Customer Service & Operations",
      setup: 3500,
      monthly: 797,
      blurb: "Qualify and help site visitors 24/7.",
      hoursSavedPerWeek: 11,
      capture: 0.57,
      statusQuoKey: "leads",
    },
    workflow_automation: {
      id: "workflow_automation",
      name: "Workflow Automation",
      category: "Customer Service & Operations",
      setup: 3000,
      monthly: 697,
      blurb: "Remove repetitive handoffs so teams leave the spreadsheet grind.",
      hoursSavedPerWeek: 12,
      capture: 0.6,
      statusQuoKey: "ops",
    },
    knowledge_assistant: {
      id: "knowledge_assistant",
      name: "Internal Knowledge Base Assistant",
      category: "Customer Service & Operations",
      setup: 5000,
      monthly: 1297,
      blurb: "Answers from your docs so staff stop hunting Slack and PDFs.",
      hoursSavedPerWeek: 10,
      capture: 0.52,
      statusQuoKey: "ops",
    },
    scheduling_automation: {
      id: "scheduling_automation",
      name: "Scheduling Automation",
      category: "Customer Service & Operations",
      setup: 4500,
      monthly: 997,
      blurb: "Calendar bookings and reminder drafts that reduce no-shows.",
      hoursSavedPerWeek: 14,
      capture: 0.58,
      statusQuoKey: "phones",
    },
    essential_managed: {
      id: "essential_managed",
      name: "Essential (Managed)",
      category: "Managed Services",
      setup: 3500,
      monthly: 997,
      blurb: "We run a focused AI worker set with you — setup isn’t the finish line.",
      hoursSavedPerWeek: 16,
      capture: 0.63,
      statusQuoKey: "managed",
    },
    growth_managed: {
      id: "growth_managed",
      name: "Growth (Managed)",
      category: "Managed Services",
      setup: 7500,
      monthly: 1997,
      blurb: "Broader managed automation for teams that need more coverage.",
      hoursSavedPerWeek: 28,
      capture: 0.68,
      statusQuoKey: "managed",
    },
    professional_managed: {
      id: "professional_managed",
      name: "Professional (Managed)",
      category: "Managed Services",
      setup: 15000,
      monthly: 3997,
      blurb: "Serious managed coverage for complex operations.",
      hoursSavedPerWeek: 40,
      capture: 0.72,
      statusQuoKey: "managed",
    },
    basic_integration: {
      id: "basic_integration",
      name: "Basic System Integration",
      category: "Systems Integration & Custom",
      setup: 3500,
      monthly: 397,
      blurb: "One live connection + prove so tools stop living in silos.",
      hoursSavedPerWeek: 8,
      capture: 0.5,
      statusQuoKey: "ops",
    },
    crm_integration: {
      id: "crm_integration",
      name: "CRM Integration",
      category: "Systems Integration & Custom",
      setup: 7500,
      monthly: 697,
      blurb: "Wire your CRM so people, stages, and follow-ups stay in sync.",
      hoursSavedPerWeek: 14,
      capture: 0.55,
      statusQuoKey: "ops",
    },
    ai_business_os: {
      id: "ai_business_os",
      name: "AI Business Operating System",
      category: "Systems Integration & Custom",
      setup: 20000,
      monthly: 3500,
      blurb: "Connect ops, CRM, and AI workers into one workspace your team uses daily.",
      hoursSavedPerWeek: 35,
      capture: 0.65,
      statusQuoKey: "ops",
    },
  };

  /**
   * Industry-average monthly cost of living with the problem (labor + missed revenue + tool sprawl).
   * Explicit assumptions so the user can see the math.
   */
  const STATUS_QUO = {
    leads: {
      label: "missed or slow lead follow-up",
      assumption: "Industry average: ~12 hrs/week of rep time on chase + ~8% of inbound leads dying from slow response.",
      baseMonthly: 7800,
      laborHoursWeek: 12,
      laborRate: 55,
      opportunityMonthly: 4200,
    },
    phones: {
      label: "unanswered calls & booking chaos",
      assumption: "Industry average: ~20 hrs/week covering phones/scheduling + missed appointments and after-hours leaks.",
      baseMonthly: 7200,
      laborHoursWeek: 20,
      laborRate: 42,
      opportunityMonthly: 3800,
    },
    ops: {
      label: "manual ops / disconnected tools",
      assumption: "Industry average: ~18 hrs/week of re-entry, chasing status, and spreadsheet glue across tools.",
      baseMonthly: 9100,
      laborHoursWeek: 18,
      laborRate: 48,
      opportunityMonthly: 2600,
    },
    managed: {
      label: "AI that never sticks / no owner",
      assumption: "Industry average: paid pilots + staff time babysitting tools that don’t compound (~$2–4k/mo waste + stalled ROI).",
      baseMonthly: 10500,
      laborHoursWeek: 10,
      laborRate: 65,
      opportunityMonthly: 5500,
    },
    discovery: {
      label: "unclear priorities / risk of buying wrong",
      assumption: "Industry average: one wrong tool buy or stalled pilot often burns $8–15k before anyone admits it.",
      baseMonthly: 4500,
      laborHoursWeek: 6,
      laborRate: 85,
      opportunityMonthly: 2200,
    },
  };

  const BUSINESS_SCALE = {
    services: {
      label: "services / agency",
      mult: 1.05,
      wage: 58,
      hypothetical: "a 12-person services firm where partners still jump into the inbox when volume spikes",
    },
    local: {
      label: "local / home services",
      mult: 0.9,
      wage: 38,
      hypothetical: "a local operator with 1–2 people covering phones between jobs",
    },
    retail: {
      label: "e-commerce / retail",
      mult: 1.15,
      wage: 45,
      hypothetical: "a retail / e-comm team juggling site chat, ads leads, and a thin support bench",
    },
    other: {
      label: "multi-location / complex",
      mult: 1.55,
      wage: 72,
      hypothetical: "a multi-site org where every handoff crosses locations and tools",
    },
  };

  const TODAY_SCALE = {
    manual: {
      label: "mostly manual / people power",
      mult: 1.2,
      severity: "high labor waste",
      twist: "Almost every recovery has to come from people working harder — until the process changes.",
    },
    tools: {
      label: "mix of tools, nothing connected",
      mult: 1.1,
      severity: "re-work and gaps between systems",
      twist: "You already pay for software; the leak is the glue work between them.",
    },
    failed_ai: {
      label: "tried AI; it didn’t stick",
      mult: 1.35,
      severity: "paid pilots plus the original leak still open",
      twist: "You’ve already spent on AI once — the ROI case has to include not repeating a dead pilot.",
    },
    exploring: {
      label: "still figuring it out",
      mult: 0.82,
      severity: "risk of buying the wrong stack",
      twist: "The biggest cost isn’t today’s leak alone — it’s buying the wrong thing next.",
    },
  };

  const QUESTIONS = [
    {
      id: "business",
      prompt: "What kind of business are you?",
      options: [
        { label: "Services / agency", value: "services" },
        { label: "Local / home services", value: "local" },
        { label: "E-commerce / retail", value: "retail" },
        { label: "Other / multi-location", value: "other" },
      ],
    },
    {
      id: "leak",
      prompt: "Where are you losing the most time or money?",
      options: [
        { label: "Missed or slow lead follow-up", value: "leads" },
        { label: "Phones / booking chaos", value: "phones" },
        { label: "Ops stuck in spreadsheets / tools", value: "ops" },
        { label: "Need a partner to run AI for us", value: "managed" },
      ],
    },
    {
      id: "today",
      prompt: "How do you handle this today?",
      options: [
        { label: "Mostly manual / people power", value: "manual" },
        { label: "Mix of tools, nothing connected", value: "tools" },
        { label: "Tried AI; it didn’t stick", value: "failed_ai" },
        { label: "Still figuring it out", value: "exploring" },
      ],
    },
  ];

  /** Full routing table — every combination is intentional. */
  const ROUTES = {
    "services|leads|exploring": "process_review",
    "services|phones|exploring": "process_review",
    "services|ops|exploring": "process_review",
    "services|managed|exploring": "process_review",
    "local|leads|exploring": "process_review",
    "local|phones|exploring": "process_review",
    "local|ops|exploring": "process_review",
    "local|managed|exploring": "process_review",
    "retail|leads|exploring": "process_review",
    "retail|phones|exploring": "process_review",
    "retail|ops|exploring": "process_review",
    "retail|managed|exploring": "process_review",
    "other|leads|exploring": "ai_strategy",
    "other|phones|exploring": "ai_strategy",
    "other|ops|exploring": "ai_strategy",
    "other|managed|exploring": "ai_strategy",

    "services|leads|manual": "lead_qualification",
    "services|leads|tools": "crm_automation",
    "services|leads|failed_ai": "essential_managed",
    "local|leads|manual": "lead_follow_up",
    "local|leads|tools": "lead_qualification",
    "local|leads|failed_ai": "essential_managed",
    "retail|leads|manual": "website_chatbot",
    "retail|leads|tools": "email_marketing",
    "retail|leads|failed_ai": "growth_managed",
    "other|leads|manual": "lead_qualification",
    "other|leads|tools": "crm_integration",
    "other|leads|failed_ai": "growth_managed",

    "services|phones|manual": "ai_inbound",
    "services|phones|tools": "appointment_scheduling",
    "services|phones|failed_ai": "essential_managed",
    "local|phones|manual": "ai_receptionist",
    "local|phones|tools": "scheduling_automation",
    "local|phones|failed_ai": "essential_managed",
    "retail|phones|manual": "ai_receptionist",
    "retail|phones|tools": "website_chatbot",
    "retail|phones|failed_ai": "growth_managed",
    "other|phones|manual": "ai_inbound",
    "other|phones|tools": "appointment_scheduling",
    "other|phones|failed_ai": "growth_managed",

    "services|ops|manual": "crm_automation",
    "services|ops|tools": "basic_integration",
    "services|ops|failed_ai": "growth_managed",
    "local|ops|manual": "workflow_automation",
    "local|ops|tools": "knowledge_assistant",
    "local|ops|failed_ai": "essential_managed",
    "retail|ops|manual": "workflow_automation",
    "retail|ops|tools": "crm_automation",
    "retail|ops|failed_ai": "growth_managed",
    "other|ops|manual": "ai_business_os",
    "other|ops|tools": "ai_business_os",
    "other|ops|failed_ai": "professional_managed",

    "services|managed|manual": "essential_managed",
    "services|managed|tools": "growth_managed",
    "services|managed|failed_ai": "growth_managed",
    "local|managed|manual": "essential_managed",
    "local|managed|tools": "essential_managed",
    "local|managed|failed_ai": "essential_managed",
    "retail|managed|manual": "growth_managed",
    "retail|managed|tools": "growth_managed",
    "retail|managed|failed_ai": "growth_managed",
    "other|managed|manual": "growth_managed",
    "other|managed|tools": "professional_managed",
    "other|managed|failed_ai": "professional_managed",
  };

  const state = {
    step: 0,
    answers: {},
    packageId: "lead_follow_up",
  };

  function money(n) {
    const rounded = Math.round(n);
    const sign = rounded < 0 ? "-" : "";
    return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
  }

  function pct(n) {
    return `${Math.round(n)}%`;
  }

  function routeKey() {
    return [
      state.answers.business?.value || "services",
      state.answers.leak?.value || "leads",
      state.answers.today?.value || "manual",
    ].join("|");
  }

  function pickPackageId() {
    return ROUTES[routeKey()] || "lead_follow_up";
  }

  function statusQuoMonthly(pkg) {
    const leak = state.answers.leak?.value || "leads";
    const business = state.answers.business?.value || "services";
    const today = state.answers.today?.value || "manual";
    const sqKey = pkg.statusQuoKey || leak;
    const sq = STATUS_QUO[sqKey] || STATUS_QUO.leads;
    const biz = BUSINESS_SCALE[business] || BUSINESS_SCALE.services;
    const tod = TODAY_SCALE[today] || TODAY_SCALE.manual;

    const laborMonthly = Math.round(sq.laborHoursWeek * 4.33 * biz.wage * tod.mult);
    const opportunity = Math.round(sq.opportunityMonthly * biz.mult * tod.mult);
    const blended = Math.round(sq.baseMonthly * biz.mult * tod.mult);
    // Prefer explicit labor + opportunity when it tells a clearer story; blend toward catalog base.
    const monthlyCost = Math.round(blended * 0.45 + (laborMonthly + opportunity) * 0.55);

    return {
      ...sq,
      monthlyCost,
      laborMonthly,
      opportunity,
      businessLabel: biz.label,
      todayLabel: tod.label,
      severity: tod.severity,
      twist: tod.twist,
      hypotheticalOrg: biz.hypothetical,
      wage: biz.wage,
    };
  }

  function computeRoi() {
    const pkg = PACKAGES[state.packageId];
    const industry = statusQuoMonthly(pkg);
    const year1VibeTech = pkg.setup + pkg.monthly * 12;
    const effectiveMonthly = year1VibeTech / 12;
    const clawBack = Math.round(industry.monthlyCost * pkg.capture);
    const netMonthly = clawBack - Math.round(effectiveMonthly);
    const year1ClawBack = clawBack * 12;
    const year1Net = year1ClawBack - year1VibeTech;
    const roiPct = year1VibeTech > 0 ? (year1Net / year1VibeTech) * 100 : 0;
    let payback = null;
    if (clawBack > pkg.monthly) {
      payback = Math.ceil(pkg.setup / (clawBack - pkg.monthly));
    } else if (clawBack > 0 && pkg.monthly === 0) {
      payback = Math.ceil(pkg.setup / clawBack);
    }

    const hoursValue = Math.round(pkg.hoursSavedPerWeek * 4.33 * industry.wage);

    return {
      pkg,
      industry,
      effectiveMonthly: Math.round(effectiveMonthly),
      year1VibeTech,
      clawBack,
      netMonthly,
      year1ClawBack,
      year1Net,
      roiPct,
      payback,
      hoursValue,
      path: routeKey(),
    };
  }

  function whyFit(r) {
    const leak = state.answers.leak?.label || "this leak";
    const today = state.answers.today?.label || "how you work today";
    return `${r.pkg.name} fits because you’re a ${r.industry.businessLabel} team dealing with ${leak.toLowerCase()}, and today that’s ${today.toLowerCase()}.`;
  }

  function hypothetical(r) {
    const org = r.industry.hypotheticalOrg;
    const name = r.pkg.name;
    if (r.pkg.monthly <= 0) {
      return `Picture ${org}. Instead of guessing the next tool, you spend ${money(r.pkg.setup)} on ${name}, leave with a ranked map of leaks, and avoid a ${money(r.industry.monthlyCost)}/mo misfire for the next quarter.`;
    }
    return `Picture ${org}. At industry averages you’re burning about ${money(r.industry.monthlyCost)}/mo on ${r.industry.label}. ${name} is ${money(r.pkg.monthly)}/mo after a ${money(r.pkg.setup)} setup. If you claw back ${pct(r.pkg.capture * 100)} of that drag (${money(r.clawBack)}/mo), you’re looking at roughly ${money(r.netMonthly)}/mo net — and about ${pkgHours(r)} of staff time redirected every week.`;
  }

  function pkgHours(r) {
    return `${r.pkg.hoursSavedPerWeek} hours`;
  }

  function explanationBlocks(r) {
    const paybackLine =
      r.payback != null
        ? `At that claw-back rate, setup pays back in about <strong>${r.payback} month${r.payback === 1 ? "" : "s"}</strong> (after covering the monthly fee).`
        : `Monthly claw-back is close to the monthly fee — treat this as a capacity play and tighten scope on a call.`;

    return [
      {
        title: "1. Industry-average cost of the status quo",
        html: `${r.industry.assumption} Scaled for a <strong>${r.industry.businessLabel}</strong> team that is <strong>${r.industry.todayLabel}</strong> (${r.industry.severity}), that lands near <strong>${money(r.industry.monthlyCost)}/mo</strong> — about <strong>${money(r.industry.laborMonthly)}</strong> in labor-shaped cost and <strong>${money(r.industry.opportunity)}</strong> in opportunity / leakage.`,
      },
      {
        title: "2. Our published price for this lane",
        html: r.pkg.monthly > 0
          ? `<strong>${r.pkg.name}</strong> is <strong>${money(r.pkg.setup)} setup</strong> + <strong>${money(r.pkg.monthly)}/mo</strong> on the rate card (~<strong>${money(r.effectiveMonthly)}/mo</strong> when setup is spread over year one; <strong>${money(r.year1VibeTech)}</strong> year-one total).`
          : `<strong>${r.pkg.name}</strong> is a <strong>${money(r.pkg.setup)} one-time</strong> engagement on the rate card (~<strong>${money(r.effectiveMonthly)}/mo</strong> if you spread it across a year).`,
      },
      {
        title: "3. What you claw back",
        html: `We model reclaiming about <strong>${pct(r.pkg.capture * 100)}</strong> of that status-quo drag with this lane — <strong>${money(r.clawBack)}/mo</strong> (~${money(r.year1ClawBack)} year one), including ~<strong>${pkgHours(r)}/week</strong> of redirected effort (worth ~${money(r.hoursValue)}/mo at your segment’s wage band). ${r.industry.twist}`,
      },
      {
        title: "4. Net ROI",
        html: `Year-one net is <strong>${money(r.year1Net)}</strong> (<strong>${pct(r.roiPct)}</strong> on the year-one VibeTech spend). Monthly net after the effective price is <strong>${money(r.netMonthly)}</strong>. ${paybackLine}`,
      },
    ];
  }

  function root() {
    return document.getElementById("roi-qualifier");
  }

  function renderQuestion() {
    const el = root();
    if (!el) return;
    const q = QUESTIONS[state.step];
    el.innerHTML = `
      <div class="rq-card">
        <div class="rq-progress" aria-hidden="true">
          ${QUESTIONS.map((_, i) => `<span class="${i <= state.step ? "on" : ""}"></span>`).join("")}
        </div>
        <p class="rq-step">Question ${state.step + 1} of ${QUESTIONS.length}</p>
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
        state.answers[q.id] = opt;
        state.step += 1;
        if (state.step >= QUESTIONS.length) {
          state.packageId = pickPackageId();
          renderResult();
        } else {
          renderQuestion();
        }
      });
    });
  }

  function priceLine(pkg) {
    if (pkg.monthly <= 0) {
      return `<strong>${money(pkg.setup)}</strong><span> one-time</span>`;
    }
    return `<strong>${money(pkg.monthly)}</strong><span>/mo</span> · setup <strong>${money(pkg.setup)}</strong>`;
  }

  function bookHref() {
    const r = computeRoi();
    const price =
      r.pkg.monthly > 0
        ? `${money(r.pkg.monthly)}/mo + ${money(r.pkg.setup)} setup`
        : `${money(r.pkg.setup)} one-time`;
    const summary = [
      `Recommended: ${r.pkg.name} (${r.pkg.category})`,
      `Path: ${state.answers.business?.label} → ${state.answers.leak?.label} → ${state.answers.today?.label}`,
      `VibeTech price: ${price}`,
      `Industry-average status quo: ${money(r.industry.monthlyCost)}/mo`,
      `Est. claw-back: ${money(r.clawBack)}/mo`,
      `Year-1 net: ${money(r.year1Net)} (${pct(r.roiPct)} ROI)`,
      r.payback != null ? `Payback: ~${r.payback} months` : "Payback: see call",
    ].join("\n");

    if (String(BOOK_CALL_URL).startsWith("mailto:")) {
      const base = BOOK_CALL_URL.split("&body=")[0];
      return `${base}&body=${encodeURIComponent(`Hi VibeTech,\n\nI'd like to book a call.\n\n${summary}\n`)}`;
    }
    try {
      const u = new URL(BOOK_CALL_URL, window.location.origin);
      u.searchParams.set("utm_content", r.pkg.id);
      return u.toString();
    } catch {
      return BOOK_CALL_URL;
    }
  }

  function renderResult() {
    const el = root();
    if (!el) return;
    const r = computeRoi();
    const blocks = explanationBlocks(r);
    const netClass = r.netMonthly >= 0 ? "rq-upside" : "rq-caution";
    const yearClass = r.year1Net >= 0 ? "rq-upside" : "rq-caution";

    el.innerHTML = `
      <div class="rq-card rq-result">
        <p class="rq-step">Your fit · ${r.pkg.category}</p>
        <p class="rq-path">
          Based on: <strong>${state.answers.business?.label}</strong>
          → <strong>${state.answers.leak?.label}</strong>
          → <strong>${state.answers.today?.label}</strong>
        </p>
        <h3 class="rq-prompt">Start here on our rate card</h3>
        <div class="rq-rec">
          <div>
            <p class="rq-rec-name">${r.pkg.name}</p>
            <p class="rq-rec-blurb">${r.pkg.blurb}</p>
            <p class="rq-fit">${whyFit(r)}</p>
            <p class="rq-rec-price">${priceLine(r.pkg)}</p>
          </div>
          <div class="rq-metrics">
            <div>
              <span class="rq-label">Industry-avg status quo</span>
              <strong>${money(r.industry.monthlyCost)}<span class="rq-unit">/mo</span></strong>
            </div>
            <div class="rq-upside">
              <span class="rq-label">Est. claw-back with this lane</span>
              <strong>${money(r.clawBack)}<span class="rq-unit">/mo</span></strong>
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
            <span class="rq-label">Year-one claw-back</span>
            <strong>${money(r.year1ClawBack)}</strong>
          </div>
          <div>
            <span class="rq-label">Payback</span>
            <strong>${r.payback != null ? `~${r.payback} mo` : "Call"}</strong>
          </div>
        </div>

        <div class="rq-why">
          <p class="rq-why-title">Full explanation</p>
          ${blocks
            .map(
              (b) => `
            <div class="rq-explain-block">
              <p class="rq-explain-title">${b.title}</p>
              <p class="rq-explain-body">${b.html}</p>
            </div>`,
            )
            .join("")}
        </div>

        <div class="rq-hypo">
          <p class="rq-why-title">Hypothetical that matches your answers</p>
          <p class="rq-hypo-body">${hypothetical(r)}</p>
        </div>

        <p class="rq-note">
          Math uses our published floors vs industry-average status-quo costs (labor + leakage), scaled to your answers.
          A call locks real scope, usage, and volume. Not a formal quote.
        </p>
        <div class="rq-actions">
          <a class="btn btn-primary" href="${bookHref()}">Book a call with this estimate</a>
          <button type="button" class="btn rq-ghost" id="rq-restart">Start over</button>
        </div>
      </div>
    `;
    el.querySelector("#rq-restart")?.addEventListener("click", () => {
      state.step = 0;
      state.answers = {};
      state.packageId = "lead_follow_up";
      renderQuestion();
    });
  }

  function init() {
    if (!root()) return;
    renderQuestion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
