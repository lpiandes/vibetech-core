/**
 * Site-wide AI consultant widget — Build my AI plan / Ask anything.
 * Calls app.vtechdevelopment.com marketing APIs; reads ROI from sessionStorage.
 */
(function () {
  const ROI_KEY = "vt.roi.assessment.v2";
  const CONSULTANT_API =
    (typeof window !== "undefined" && window.VIBETECH_CONSULTANT_API) ||
    "https://app.vtechdevelopment.com/api/marketing/consultant";
  const MEETING_API =
    (typeof window !== "undefined" && window.VIBETECH_MEETING_API) ||
    "https://app.vtechdevelopment.com/api/marketing/meeting-request";

  const state = {
    open: false,
    mode: "ask", // ask | plan | meeting
    messages: [],
    busy: false,
  };

  function readRoi() {
    try {
      if (window.VIBETECH_ROI_ASSESSMENT) return window.VIBETECH_ROI_ASSESSMENT;
      const raw = sessionStorage.getItem(ROI_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function ensureDom() {
    if (document.getElementById("vt-consultant-root")) return;
    const root = document.createElement("div");
    root.id = "vt-consultant-root";
    root.innerHTML = `
      <button type="button" class="vt-consultant-fab" id="vt-consultant-fab" aria-haspopup="dialog">
        Build my AI plan
      </button>
      <div class="vt-consultant-panel" id="vt-consultant-panel" role="dialog" aria-modal="true" aria-labelledby="vt-consultant-title" hidden>
        <div class="vt-consultant-head">
          <div>
            <h2 id="vt-consultant-title">VibeTech AI Consultant</h2>
            <p>Ask anything — or build a plan from your ROI answers.</p>
          </div>
          <button type="button" class="vt-consultant-close" id="vt-consultant-close" aria-label="Close">×</button>
        </div>
        <div class="vt-consultant-tabs" role="tablist">
          <button type="button" data-mode="ask" class="on">Ask</button>
          <button type="button" data-mode="plan">Build my plan</button>
          <button type="button" data-mode="meeting">Request meeting</button>
        </div>
        <div class="vt-consultant-messages" id="vt-consultant-messages" aria-live="polite"></div>
        <form class="vt-consultant-form" id="vt-consultant-form">
          <label class="vt-hp" aria-hidden="true">Company website<input type="text" name="company_website" tabindex="-1" autocomplete="off" /></label>
          <div class="vt-meeting-fields" id="vt-meeting-fields" hidden>
            <input name="name" type="text" placeholder="Your name" autocomplete="name" />
            <input name="email" type="email" placeholder="Work email" autocomplete="email" />
            <input name="preferredTimes" type="text" placeholder="Preferred meeting times" />
            <textarea name="notes" placeholder="Anything else we should know?"></textarea>
          </div>
          <textarea name="message" id="vt-consultant-input" placeholder="e.g. Can AI help my insurance agency?" rows="2"></textarea>
          <div class="vt-consultant-actions">
            <button type="submit" class="btn btn-primary" id="vt-consultant-send">Send</button>
          </div>
          <p class="vt-status" id="vt-consultant-status"></p>
        </form>
      </div>
    `;
    document.body.appendChild(root);

    document.getElementById("vt-consultant-fab")?.addEventListener("click", () => openPanel("plan"));
    document.getElementById("vt-consultant-close")?.addEventListener("click", closePanel);
    document.querySelectorAll(".vt-consultant-tabs [data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => setMode(btn.getAttribute("data-mode") || "ask"));
    });
    document.getElementById("vt-consultant-form")?.addEventListener("submit", onSubmit);

    document.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const opener = t.closest("[data-vt-open-consultant]");
      if (!opener) return;
      e.preventDefault();
      openPanel(opener.getAttribute("data-vt-open-consultant") || "ask");
    });

    window.addEventListener("vt:open-consultant", (e) => {
      const mode = e?.detail?.mode || "plan";
      openPanel(mode);
    });
  }

  function setStatus(text) {
    const el = document.getElementById("vt-consultant-status");
    if (el) el.textContent = text || "";
  }

  function renderMessages() {
    const box = document.getElementById("vt-consultant-messages");
    if (!box) return;
    box.innerHTML = state.messages
      .map((m) => `<div class="vt-msg ${m.role === "user" ? "user" : "bot"}">${escapeHtml(m.content)}</div>`)
      .join("");
    box.scrollTop = box.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll(".vt-consultant-tabs [data-mode]").forEach((btn) => {
      btn.classList.toggle("on", btn.getAttribute("data-mode") === mode);
    });
    const meeting = document.getElementById("vt-meeting-fields");
    const input = document.getElementById("vt-consultant-input");
    const send = document.getElementById("vt-consultant-send");
    if (meeting) meeting.hidden = mode !== "meeting";
    if (input) {
      input.hidden = mode === "meeting";
      input.placeholder =
        mode === "plan"
          ? "Tell us your top goal or objection…"
          : "e.g. Can AI help my insurance agency?";
    }
    if (send) send.textContent = mode === "meeting" ? "Send meeting request" : "Send";
    if (mode === "plan" && state.messages.length === 0) {
      seedPlan();
    }
  }

  function seedPlan() {
    const roi = readRoi();
    const intro = roi?.recommendation?.packageName
      ? `I see your ROI assessment recommended **${roi.recommendation.packageName}** with a modeled recoverable around $${roi.math?.monthlyRecoverable}/mo (estimate, not a guarantee). What outcome matters most in the next 90 days?`
      : "Let's build your AI plan. Take the homepage ROI assessment if you haven't — or tell me your industry and biggest time sink, and I'll recommend a starting lane from our rate card.";
    state.messages = [{ role: "assistant", content: intro.replace(/\*\*/g, "") }];
    renderMessages();
  }

  function openPanel(mode) {
    ensureDom();
    state.open = true;
    const panel = document.getElementById("vt-consultant-panel");
    if (panel) panel.hidden = false;
    setMode(mode === "meeting" ? "meeting" : mode === "plan" ? "plan" : "ask");
    if (mode === "ask" && state.messages.length === 0) {
      state.messages = [
        {
          role: "assistant",
          content:
            "Ask me anything — for example: “Can AI help my insurance agency?” I’ll answer instantly and stay on our published rate card.",
        },
      ];
      renderMessages();
    }
  }

  function closePanel() {
    state.open = false;
    const panel = document.getElementById("vt-consultant-panel");
    if (panel) panel.hidden = true;
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (state.busy) return;
    const form = e.target;
    const fd = new FormData(form);
    const honeypot = String(fd.get("company_website") || "");
    const roi = readRoi();

    if (state.mode === "meeting") {
      const name = String(fd.get("name") || "").trim();
      const email = String(fd.get("email") || "").trim();
      const preferredTimes = String(fd.get("preferredTimes") || "").trim();
      const notes = String(fd.get("notes") || "").trim();
      if (!name || !email) {
        setStatus("Name and email are required.");
        return;
      }
      state.busy = true;
      setStatus("Sending…");
      try {
        const res = await fetch(MEETING_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            preferredTimes,
            notes,
            honeypot,
            company_website: honeypot,
            roiAssessment: roi,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Request failed");
        state.messages.push({
          role: "assistant",
          content:
            "Meeting request sent to the VibeTech team. We'll reply by email to confirm a time.",
        });
        renderMessages();
        setStatus("Sent.");
        form.reset();
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Could not send");
      } finally {
        state.busy = false;
      }
      return;
    }

    const message = String(fd.get("message") || "").trim();
    if (!message) return;
    state.messages.push({ role: "user", content: message });
    renderMessages();
    form.querySelector("#vt-consultant-input").value = "";
    state.busy = true;
    setStatus("Thinking…");
    try {
      const res = await fetch(CONSULTANT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: state.messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
          roiAssessment: roi,
          honeypot,
          company_website: honeypot,
          mode: state.mode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Consultant unavailable");
      state.messages.push({ role: "assistant", content: String(data.reply || "") });
      renderMessages();
      setStatus("");
    } catch (err) {
      state.messages.push({
        role: "assistant",
        content:
          "I couldn't reach the live consultant just now. Email leopiandes@vtechdevelopment.com or use Request meeting.",
      });
      renderMessages();
      setStatus(err instanceof Error ? err.message : "Error");
    } finally {
      state.busy = false;
    }
  }

  function init() {
    ensureDom();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
