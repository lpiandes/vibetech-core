/**
 * Why accordion + testimonial story walkthroughs + video-slot activation.
 * Drop real mp4 URLs via window.VIBETECH_VIDEOS = { "why-consulting": "/videos/....mp4", ... }
 */
(function () {
  function initWhyPanels() {
    document.querySelectorAll("[data-why-panel]").forEach((panel) => {
      const trigger = panel.querySelector(".why-panel-trigger");
      const body = panel.querySelector(".why-panel-body");
      if (!trigger || !body) return;
      trigger.addEventListener("click", () => {
        const open = panel.hasAttribute("open");
        document.querySelectorAll("[data-why-panel][open]").forEach((other) => {
          if (other === panel) return;
          other.removeAttribute("open");
          const t = other.querySelector(".why-panel-trigger");
          const b = other.querySelector(".why-panel-body");
          if (t) t.setAttribute("aria-expanded", "false");
          if (b) b.hidden = true;
        });
        if (open) {
          panel.removeAttribute("open");
          trigger.setAttribute("aria-expanded", "false");
          body.hidden = true;
        } else {
          panel.setAttribute("open", "");
          trigger.setAttribute("aria-expanded", "true");
          body.hidden = false;
        }
      });
    });
  }

  function initStoryCards() {
    document.querySelectorAll(".story-card[data-story]").forEach((card) => {
      const steps = Array.from(card.querySelectorAll(".story-step"));
      if (steps.length < 2) return;
      let index = 0;
      const prev = card.querySelector(".story-prev");
      const next = card.querySelector(".story-next");
      const progress = card.querySelector(".story-progress");

      function render() {
        steps.forEach((step, i) => {
          const on = i === index;
          step.classList.toggle("on", on);
          step.hidden = !on;
        });
        if (progress) progress.textContent = `${index + 1} / ${steps.length}`;
        if (prev) prev.disabled = index === 0;
        if (next) next.textContent = index >= steps.length - 1 ? "Replay" : "Next";
      }

      prev?.addEventListener("click", () => {
        index = Math.max(0, index - 1);
        render();
      });
      next?.addEventListener("click", () => {
        if (index >= steps.length - 1) index = 0;
        else index += 1;
        render();
      });
      render();
    });
  }

  function animateDashboard() {
    const pipe = document.querySelector("[data-demo-pipe]");
    const open = document.querySelector("[data-demo-open]");
    const kpi = document.querySelector("[data-demo-kpi]");
    if (!pipe && !open && !kpi) return;
    let n = 42000;
    let loops = 7;
    setInterval(() => {
      n += Math.round(200 + Math.random() * 800);
      loops = Math.max(2, loops + (Math.random() > 0.55 ? -1 : 1));
      if (pipe) pipe.textContent = `$${(n / 1000).toFixed(0)}k`;
      if (open) open.textContent = String(loops);
      if (kpi) {
        const sec = 35 + Math.floor(Math.random() * 40);
        kpi.textContent = `0:${String(sec).padStart(2, "0")}`;
      }
    }, 2200);
  }

  function applyVideoSlots() {
    const map = window.VIBETECH_VIDEOS || {};
    document.querySelectorAll("[data-video-slot]").forEach((host) => {
      const key = host.getAttribute("data-video-slot");
      const url = key && map[key];
      if (!url) return;
      const slot = host.querySelector(".video-slot");
      const video = slot?.querySelector("video");
      const source = video?.querySelector("source");
      if (!slot || !video || !source) return;
      source.src = url;
      video.load();
      slot.hidden = false;
      host.querySelector(".demo-stage")?.setAttribute("hidden", "");
    });
  }

  function init() {
    initWhyPanels();
    initStoryCards();
    animateDashboard();
    applyVideoSlots();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
