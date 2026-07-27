/**
 * Hostinger marketing interactions — chatbot, ROI, starting-at rates.
 * Edit STARTING_AT before publishing. These are public floor prices only.
 */

const STARTING_AT = [
  {
    id: "ai_business_os",
    name: "AI Business Operating System",
    startingAt: 2500,
    unit: "/mo",
    blurb: "Full Architect → pack → Launch workspace.",
    lane: "platform",
  },
  {
    id: "ai_receptionist",
    name: "AI Receptionist",
    startingAt: 799,
    unit: "/mo",
    blurb: "Inbound calls, knowledge answers, notes & booking holds.",
    lane: "voice",
  },
  {
    id: "lead_follow_up",
    name: "Lead qualification & follow-up",
    startingAt: 599,
    unit: "/mo",
    blurb: "Capture, score-light qualify, and chase the right leads.",
    lane: "growth",
  },
  {
    id: "crm_automation",
    name: "CRM Automation",
    startingAt: 499,
    unit: "/mo",
    blurb: "Pipeline hygiene and stage-triggered follow-through.",
    lane: "growth",
  },
  {
    id: "essential_managed",
    name: "Essential Managed",
    startingAt: 3500,
    unit: "/mo",
    blurb: "Managed ops retainer with a focused worker set.",
    lane: "managed",
  },
  {
    id: "discovery",
    name: "Discovery & consulting",
    startingAt: 1500,
    unit: " engagement",
    blurb: "Assessments and workshops before you buy the stack.",
    lane: "consulting",
  },
];

const LANE_TO_PACKAGE = {
  platform: "ai_business_os",
  voice: "ai_receptionist",
  growth: "lead_follow_up",
  managed: "essential_managed",
  consulting: "discovery",
};

const QUESTIONS = [
  {
    id: "industry",
    prompt: "What kind of business are you running?",
    options: [
      { label: "Services / agency", value: "services", laneHint: "growth" },
      { label: "Local / home services", value: "local", laneHint: "voice" },
      { label: "E-commerce / retail", value: "retail", laneHint: "growth" },
      { label: "Other / multi-location", value: "other", laneHint: "platform" },
    ],
  },
  {
    id: "pain",
    prompt: "Where does the most money leak today?",
    options: [
      { label: "Missed or slow lead follow-up", value: "leads", laneHint: "growth", hours: 12, volume: 120 },
      { label: "Phones / booking chaos", value: "phones", laneHint: "voice", hours: 15, volume: 200 },
      { label: "Ops still stuck in spreadsheets", value: "ops", laneHint: "platform", hours: 18, volume: 80 },
      { label: "Need a partner to run it", value: "managed", laneHint: "managed", hours: 20, volume: 100 },
    ],
  },
  {
    id: "process",
    prompt: "How do you handle this today?",
    options: [
      { label: "Mostly manual / people power", value: "manual", laneHint: "growth" },
      { label: "Mix of tools, nothing connected", value: "tools", laneHint: "platform" },
      { label: "We tried AI; it didn’t stick", value: "failed_ai", laneHint: "managed" },
      { label: "Still figuring it out", value: "exploring", laneHint: "consulting" },
    ],
  },
];

const answers = {};
let packageId = "lead_follow_up";

function money(n) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function packageFor(id) {
  return STARTING_AT.find((p) => p.id === id) || STARTING_AT[0];
}

function renderRates() {
  const grid = document.getElementById("rate-grid");
  if (!grid) return;
  grid.innerHTML = STARTING_AT.map(
    (p) => `
    <article class="rate-card">
      <h3>${p.name}</h3>
      <p class="price">${money(p.startingAt)}<span> starting${p.unit}</span></p>
      <p>${p.blurb}</p>
    </article>`,
  ).join("");
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function addBubble(root, text, who) {
  root.appendChild(el("div", `chat-bubble ${who}`, text));
  root.scrollTop = root.scrollHeight;
}

function scoreLane() {
  const votes = {};
  for (const q of QUESTIONS) {
    const a = answers[q.id];
    if (!a?.laneHint) continue;
    votes[a.laneHint] = (votes[a.laneHint] || 0) + 1;
  }
  let best = "growth";
  let bestScore = -1;
  for (const [lane, score] of Object.entries(votes)) {
    if (score > bestScore) {
      best = lane;
      bestScore = score;
    }
  }
  return best;
}

function applyRoiDefaultsFromAnswers() {
  const pain = answers.pain;
  if (!pain) return;
  const hours = document.getElementById("roi-hours");
  const volume = document.getElementById("roi-volume");
  if (hours && pain.hours) hours.value = String(pain.hours);
  if (volume && pain.volume) volume.value = String(pain.volume);
  updateRoi();
}

function finishChat(root) {
  const lane = scoreLane();
  packageId = LANE_TO_PACKAGE[lane] || "lead_follow_up";
  const pkg = packageFor(packageId);
  addBubble(
    root,
    `Got it — based on that, I’d start you in “${pkg.name}” (from ${money(pkg.startingAt)}${pkg.unit}). Tweak the ROI sliders, then inquire with the numbers.`,
    "bot",
  );
  applyRoiDefaultsFromAnswers();
  updateInquireLink();
  document.getElementById("roi")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function askQuestion(root, index) {
  if (index >= QUESTIONS.length) {
    finishChat(root);
    return;
  }
  const q = QUESTIONS[index];
  addBubble(root, q.prompt, "bot");
  const options = el("div", "chat-options");
  for (const opt of q.options) {
    const btn = el("button", "", opt.label);
    btn.type = "button";
    btn.addEventListener("click", () => {
      answers[q.id] = opt;
      addBubble(root, opt.label, "user");
      options.remove();
      askQuestion(root, index + 1);
    });
    options.appendChild(btn);
  }
  root.appendChild(options);
}

function initChat() {
  const root = document.getElementById("chatbot");
  if (!root) return;
  root.innerHTML = "";
  addBubble(root, "Hi — I’m the VibeTech qualifier. Three quick questions, then we’ll sketch an ROI picture.", "bot");
  askQuestion(root, 0);
}

function updateRoi() {
  const hours = Number(document.getElementById("roi-hours")?.value || 10);
  const wage = Number(document.getElementById("roi-wage")?.value || 45);
  const volume = Number(document.getElementById("roi-volume")?.value || 80);
  const close = Number(document.getElementById("roi-close")?.value || 25);

  const hoursEl = document.getElementById("roi-hours-val");
  const wageEl = document.getElementById("roi-wage-val");
  const volumeEl = document.getElementById("roi-volume-val");
  const closeEl = document.getElementById("roi-close-val");
  if (hoursEl) hoursEl.textContent = String(hours);
  if (wageEl) wageEl.textContent = String(wage);
  if (volumeEl) volumeEl.textContent = String(volume);
  if (closeEl) closeEl.textContent = String(close);

  const monthlyLabor = hours * wage * 4.33;
  const recoveredShare = Math.min(0.55, 0.2 + close / 200);
  const volumeBoost = volume * (close / 100) * (wage * 0.35);
  const grossUpside = monthlyLabor * recoveredShare + volumeBoost * 0.15;
  const pkg = packageFor(packageId);
  const net = Math.max(0, grossUpside - pkg.startingAt);

  const drag = document.getElementById("roi-drag");
  const pack = document.getElementById("roi-package");
  const savings = document.getElementById("roi-savings");
  if (drag) drag.textContent = money(monthlyLabor);
  if (pack) pack.textContent = `${money(pkg.startingAt)}${pkg.unit}`;
  if (savings) savings.textContent = money(net);
  updateInquireLink({ hours, wage, volume, close, net, pkg });
}

function updateInquireLink(state) {
  const cta = document.getElementById("inquire-cta");
  if (!cta) return;
  const pkg = state?.pkg || packageFor(packageId);
  const hours = state?.hours ?? document.getElementById("roi-hours")?.value;
  const wage = state?.wage ?? document.getElementById("roi-wage")?.value;
  const volume = state?.volume ?? document.getElementById("roi-volume")?.value;
  const close = state?.close ?? document.getElementById("roi-close")?.value;
  const industry = answers.industry?.label || "n/a";
  const pain = answers.pain?.label || "n/a";
  const process = answers.process?.label || "n/a";
  const body = [
    "Hi VibeTech,",
    "",
    "I used the site qualifier + ROI calculator.",
    `Industry: ${industry}`,
    `Pain: ${pain}`,
    `Current process: ${process}`,
    `Suggested starting package: ${pkg.name} (${money(pkg.startingAt)}${pkg.unit})`,
    `ROI inputs: ${hours} hrs/wk @ $${wage}/hr, ${volume} volume/mo, ${close}% close`,
    state?.net != null ? `Rough monthly upside vs starting-at: ${money(state.net)}` : "",
    "",
    "Please follow up with a scoped quote.",
  ]
    .filter(Boolean)
    .join("\n");
  cta.href = `mailto:hello@vtechdevelopment.com?subject=${encodeURIComponent(`Inquiry — ${pkg.name}`)}&body=${encodeURIComponent(body)}`;
}

function bindRoi() {
  for (const id of ["roi-hours", "roi-wage", "roi-volume", "roi-close"]) {
    document.getElementById(id)?.addEventListener("input", updateRoi);
  }
  updateRoi();
}

document.getElementById("year").textContent = String(new Date().getFullYear());
renderRates();
initChat();
bindRoi();
