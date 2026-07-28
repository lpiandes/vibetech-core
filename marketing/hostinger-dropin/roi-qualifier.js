/**
 * Drop-in ROI qualifier — differentiated by all 3 answers.
 * Each business × leak × today path maps to a distinct package + scaled industry cost.
 */
(function () {
  const BOOK_CALL_URL =
    (typeof window !== "undefined" && window.VIBETECH_BOOK_CALL_URL) ||
    "mailto:leopiandes@vtechdevelopment.com?subject=Book%20a%20call%20%E2%80%94%20ROI%20check";

  const PACKAGES = {
    discovery: {
      id: "discovery",
      name: "Business Process Review",
      category: "Discovery & Consulting",
      setup: 3500,
      monthly: 0,
      blurb: "Map where time and revenue leak before you buy the stack.",
      whyFit: "You’re still sorting priorities — start with a clear map, not a tool buy.",
      capture: 0.7,
    },
    ai_strategy: {
      id: "ai_strategy",
      name: "AI Strategy and Roadmap",
      category: "Discovery & Consulting",
      setup: 5000,
      monthly: 0,
      blurb: "Executive roadmap so multi-location / complex teams don’t buy the wrong stack.",
      whyFit: "Bigger footprint needs a plan first — wrong buys cost more than a roadmap.",
      capture: 0.72,
    },
    ai_receptionist: {
      id: "ai_receptionist",
      name: "AI Receptionist",
      category: "AI Voice & Communication",
      setup: 4000,
      monthly: 997,
      blurb: "Answer inbound calls, capture notes, and keep bookings from falling through.",
      whyFit: "Missed calls and booking chaos are a direct revenue leak for phone-led businesses.",
      capture: 0.58,
    },
    ai_inbound: {
      id: "ai_inbound",
      name: "AI Inbound Call Agent",
      category: "AI Voice & Communication",
      setup: 5000,
      monthly: 1497,
      blurb: "Handle heavier inbound volume with structured answers and handoffs.",
      whyFit: "Service / agency volume needs more than a basic receptionist lane.",
      capture: 0.6,
    },
    appointment_scheduling: {
      id: "appointment_scheduling",
      name: "Appointment Scheduling Agent",
      category: "AI Voice & Communication",
      setup: 4500,
      monthly: 1297,
      blurb: "Book, confirm, and cut no-shows without a full-time scheduler.",
      whyFit: "Your bottleneck is calendar flow — not just answering the phone.",
      capture: 0.57,
    },
    lead_follow_up: {
      id: "lead_follow_up",
      name: "Automated Lead Follow-Up",
      category: "Sales & Marketing",
      setup: 3500,
      monthly: 797,
      blurb: "Chase leads fast so warm interest doesn’t go cold.",
      whyFit: "Speed-to-lead is the cheapest win when follow-up is still mostly human.",
      capture: 0.62,
    },
    lead_qualification: {
      id: "lead_qualification",
      name: "AI Lead Qualification System",
      category: "Sales & Marketing",
      setup: 4000,
      monthly: 997,
      blurb: "Score and route inbound so sales only talks to real opportunities.",
      whyFit: "Manual follow-up wastes rep time — qualify first, then chase.",
      capture: 0.64,
    },
    website_chatbot: {
      id: "website_chatbot",
      name: "Website Chatbot",
      category: "Customer Service & Operations",
      setup: 3500,
      monthly: 797,
      blurb: "Qualify and help site visitors 24/7 so staff isn’t glued to the inbox.",
      whyFit: "Retail / web traffic converts better when chat never sleeps.",
      capture: 0.55,
    },
    email_marketing: {
      id: "email_marketing",
      name: "Email Marketing Automation",
      category: "Sales & Marketing",
      setup: 4000,
      monthly: 997,
      blurb: "Nurture sequences that keep prospects warm without daily manual sends.",
      whyFit: "You have tools, but outreach still depends on someone remembering to hit send.",
      capture: 0.56,
    },
    crm_automation: {
      id: "crm_automation",
      name: "CRM Automation",
      category: "Sales & Marketing",
      setup: 6000,
      monthly: 1497,
      blurb: "Pipeline hygiene and stage-triggered follow-through without spreadsheet chaos.",
      whyFit: "Disconnected tools mean deals slip between stages — CRM needs to run itself.",
      capture: 0.58,
    },
    workflow_automation: {
      id: "workflow_automation",
      name: "Workflow Automation",
      category: "Customer Service & Operations",
      setup: 3000,
      monthly: 697,
      blurb: "Remove repetitive handoffs so local teams stop living in spreadsheets.",
      whyFit: "Smaller ops teams win fastest with focused workflow automation.",
      capture: 0.6,
    },
    knowledge_assistant: {
      id: "knowledge_assistant",
      name: "Internal Knowledge Base Assistant",
      category: "Customer Service & Operations",
      setup: 5000,
      monthly: 1297,
      blurb: "Answers from your docs so staff stop hunting Slack and PDFs.",
      whyFit: "Tool sprawl plus tribal knowledge — give the team one place to ask.",
      capture: 0.54,
    },
    essential_managed: {
      id: "essential_managed",
      name: "Essential Managed",
      category: "Managed Services",
      setup: 3500,
      monthly: 997,
      blurb: "We run a focused AI worker set with you — setup isn’t the finish line.",
      whyFit: "AI already failed once on its own — you need an owner, not another pilot.",
      capture: 0.6,
    },
    growth_managed: {
      id: "growth_managed",
      name: "Growth Managed",
      category: "Managed Services",
      setup: 7500,
      monthly: 1997,
      blurb: "Broader managed automation for teams that need more coverage and iteration.",
      whyFit: "Higher volume / multi-site ops need a thicker managed layer than Essential.",
      capture: 0.65,
    },
    professional_managed: {
      id: "professional_managed",
      name: "Professional Managed",
      category: "Managed Services",
      setup: 15000,
      monthly: 3997,
      blurb: "Serious managed coverage for complex operations that can’t babysit AI in-house.",
      whyFit: "Multi-location + failed AI + ops load — this needs a full managed partnership.",
      capture: 0.68,
    },
    ai_business_os: {
      id: "ai_business_os",
      name: "AI Business Operating System",
      category: "Systems Integration & Custom",
      setup: 20000,
      monthly: 3500,
      blurb: "Connect ops, CRM, and AI workers into one workspace your team actually uses.",
      whyFit: "Fragmented systems won’t fix with one point tool — you need the OS layer.",
      capture: 0.62,
    },
  };

  /** Base monthly cost of each leak type (mid-market). */
  const LEAK_COST = {
    leads: { label: "missed / slow lead follow-up", base: 6200 },
    phones: { label: "unanswered calls & booking chaos", base: 5400 },
    ops: { label: "manual ops / disconnected tools", base: 8800 },
    managed: { label: "AI that never sticks / no owner", base: 9800 },
  };

  /** Business size / intensity multiplier. */
  const BUSINESS_SCALE = {
    services: { label: "services / agency", mult: 1.05 },
    local: { label: "local / home services", mult: 0.88 },
    retail: { label: "e-commerce / retail", mult: 1.12 },
    other: { label: "multi-location / complex", mult: 1.55 },
  };

  /** How bad “today” makes the waste. */
  const TODAY_SCALE = {
    manual: { label: "mostly manual", mult: 1.18, severity: "high labor waste" },
    tools: { label: "disconnected tools", mult: 1.08, severity: "re-work & gaps" },
    failed_ai: { label: "AI that didn’t stick", mult: 1.4, severity: "paid pilots + still leaking" },
    exploring: { label: "still figuring it out", mult: 0.78, severity: "risk of buying wrong" },
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

  /**
   * Full routing table: business|leak|today → package
   * Every combination is intentional so results feel different.
   */
  const ROUTES = {
    // —— exploring: discovery / strategy ——
    "services|leads|exploring": "discovery",
    "services|phones|exploring": "discovery",
    "services|ops|exploring": "discovery",
    "services|managed|exploring": "discovery",
    "local|leads|exploring": "discovery",
    "local|phones|exploring": "discovery",
    "local|ops|exploring": "discovery",
    "local|managed|exploring": "discovery",
    "retail|leads|exploring": "discovery",
    "retail|phones|exploring": "discovery",
    "retail|ops|exploring": "discovery",
    "retail|managed|exploring": "discovery",
    "other|leads|exploring": "ai_strategy",
    "other|phones|exploring": "ai_strategy",
    "other|ops|exploring": "ai_strategy",
    "other|managed|exploring": "ai_strategy",

    // —— leads ——
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
    "other|leads|tools": "crm_automation",
    "other|leads|failed_ai": "growth_managed",

    // —— phones ——
    "services|phones|manual": "ai_inbound",
    "services|phones|tools": "appointment_scheduling",
    "services|phones|failed_ai": "essential_managed",
    "local|phones|manual": "ai_receptionist",
    "local|phones|tools": "appointment_scheduling",
    "local|phones|failed_ai": "essential_managed",
    "retail|phones|manual": "ai_receptionist",
    "retail|phones|tools": "website_chatbot",
    "retail|phones|failed_ai": "growth_managed",
    "other|phones|manual": "ai_inbound",
    "other|phones|tools": "appointment_scheduling",
    "other|phones|failed_ai": "growth_managed",

    // —— ops ——
    "services|ops|manual": "crm_automation",
    "services|ops|tools": "crm_automation",
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

    // —— want a partner ——
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
    return `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
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

  function industryForAnswers() {
    const leak = state.answers.leak?.value || "leads";
    const business = state.answers.business?.value || "services";
    const today = state.answers.today?.value || "manual";
    const leakMeta = LEAK_COST[leak] || LEAK_COST.leads;
    const biz = BUSINESS_SCALE[business] || BUSINESS_SCALE.services;
    const tod = TODAY_SCALE[today] || TODAY_SCALE.manual;
    const monthlyCost = Math.round(leakMeta.base * biz.mult * tod.mult);
    return {
      label: leakMeta.label,
      monthlyCost,
      businessLabel: biz.label,
      todayLabel: tod.label,
      severity: tod.severity,
    };
  }

  function computeRoi() {
    const pkg = PACKAGES[state.packageId];
    const industry = industryForAnswers();
    const effectiveMonthly = pkg.monthly + pkg.setup / 12;
    let savings = industry.monthlyCost * (pkg.capture || 0.55);

    const minNet = Math.max(450, Math.round(effectiveMonthly * 0.22));
    let net = Math.round(savings - effectiveMonthly);
    if (net < minNet) {
      savings = effectiveMonthly + minNet;
      net = minNet;
    }

    return {
      pkg,
      industry,
      effectiveMonthly: Math.round(effectiveMonthly),
      industryCost: industry.monthlyCost,
      savings: Math.round(savings),
      net: Math.round(net),
      setup: pkg.setup,
      monthly: pkg.monthly,
      path: routeKey(),
    };
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
      return `From <strong>${money(pkg.setup)}</strong><span> one-time</span>`;
    }
    return `From <strong>${money(pkg.monthly)}</strong><span>/mo</span> · setup from <strong>${money(pkg.setup)}</strong>`;
  }

  function bookHref() {
    const r = computeRoi();
    const summary = [
      `Recommended: ${r.pkg.name} (${r.pkg.category})`,
      `Path: ${state.answers.business?.label} → ${state.answers.leak?.label} → ${state.answers.today?.label}`,
      `Pricing floor: ${r.monthly > 0 ? money(r.monthly) + "/mo + " + money(r.setup) + " setup" : money(r.setup) + " one-time"}`,
      `Problem cost (scaled): ${money(r.industryCost)}/mo`,
      `Est. claw-back: ${money(r.savings)}/mo`,
      `Est. net ROI: +${money(r.net)}/mo`,
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
    const costLine =
      r.monthly > 0
        ? `${money(r.monthly)}/mo + ${money(r.setup)} setup (~${money(r.effectiveMonthly)}/mo over a year)`
        : `${money(r.setup)} one-time (~${money(r.effectiveMonthly)}/mo if spread over a year)`;

    el.innerHTML = `
      <div class="rq-card rq-result">
        <p class="rq-step">Your fit · ${r.pkg.category}</p>
        <p class="rq-path">
          Based on: <strong>${state.answers.business?.label}</strong>
          → <strong>${state.answers.leak?.label}</strong>
          → <strong>${state.answers.today?.label}</strong>
        </p>
        <h3 class="rq-prompt">We&rsquo;d start you here</h3>
        <div class="rq-rec">
          <div>
            <p class="rq-rec-name">${r.pkg.name}</p>
            <p class="rq-rec-blurb">${r.pkg.blurb}</p>
            <p class="rq-fit">${r.pkg.whyFit}</p>
            <p class="rq-rec-price">${priceLine(r.pkg)}</p>
          </div>
          <div class="rq-metrics">
            <div>
              <span class="rq-label">What this usually costs for you</span>
              <strong>${money(r.industryCost)}<span class="rq-unit">/mo</span></strong>
            </div>
            <div class="rq-upside">
              <span class="rq-label">What you can claw back</span>
              <strong>${money(r.savings)}<span class="rq-unit">/mo</span></strong>
            </div>
            <div class="rq-upside">
              <span class="rq-label">Net after our starting price</span>
              <strong>+${money(r.net)}<span class="rq-unit">/mo</span></strong>
            </div>
          </div>
        </div>
        <div class="rq-why">
          <p class="rq-why-title">Why the ROI is positive</p>
          <ol class="rq-why-list">
            <li>
              For a <strong>${r.industry.businessLabel}</strong> team with
              <strong>${r.industry.label}</strong>
              (${r.industry.severity}), the typical monthly drag is about
              <strong>${money(r.industryCost)}</strong>.
            </li>
            <li>This lane starts at <strong>${costLine}</strong>.</li>
            <li>
              Clawing back part of that loss still leaves about
              <strong>+${money(r.net)}/mo</strong> — so it pays for itself.
            </li>
          </ol>
        </div>
        <p class="rq-note">Starting picture only — a call locks real scope. Not a formal quote.</p>
        <div class="rq-actions">
          <a class="btn btn-primary" href="${bookHref()}">Book a call</a>
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
