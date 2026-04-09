"use strict";

(function () {
  const DEFAULT_CONFETTI_COLORS = [
    "#fde047",
    "#4ade80",
    "#38bdf8",
    "#f472b6",
    "#a78bfa",
    "#fb923c",
  ];

  /**
   * @param {Record<string, string>} colors
   */
  function applyRocketColors(colors) {
    const body = document.body;
    if (!body || !colors) return;
    for (const [key, raw] of Object.entries(colors)) {
      if (raw == null || String(raw).trim() === "") continue;
      const val = String(raw).trim();
      if (key === "mesh_url") {
        body.style.setProperty("--rocket-bg-mesh", `url("${val}")`);
        continue;
      }
      if (key === "confetti_colors") {
        window.__rocketConfettiColors = val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        continue;
      }
      const cssName = "--rocket-" + key.replace(/_/g, "-");
      body.style.setProperty(cssName, val);
    }
  }

  async function loadRocketColors() {
    try {
      const r = await fetch("/api/rocket-colors");
      if (!r.ok) return;
      const data = await r.json();
      if (data && data.colors && typeof data.colors === "object") {
        applyRocketColors(data.colors);
      }
    } catch {
      /* keep rocket-theme.css defaults */
    }
  }

  loadRocketColors();

  const stage = document.getElementById("rocket-stage");
  const statusEl = document.getElementById("rocket-status");
  const btnGreat = document.getElementById("btn-great");
  const btnMeh = document.getElementById("btn-meh");
  const btnFail = document.getElementById("btn-fail");
  const canvas = document.getElementById("confetti-canvas");

  /**
   * Global `confetti()` ignores a custom `canvas` option; it always uses an internal
   * full-page canvas. Bind to our stage canvas via `create` (see canvas-confetti docs).
   */
  function getStageConfetti() {
    if (typeof confetti !== "function" || !canvas || typeof confetti.create !== "function") {
      return null;
    }
    if (!window.__rocketStageConfetti) {
      window.__rocketStageConfetti = confetti.create(canvas, {
        resize: false,
        useWorker: false,
      });
    }
    return window.__rocketStageConfetti;
  }

  const SCENARIOS = {
    great: { className: "rocket-stage--great", durationMs: 4700, label: "Great success!" },
    meh: { className: "rocket-stage--meh", durationMs: 3600, label: "Meh!" },
    fail: { className: "rocket-stage--fail", durationMs: 3800, label: "Failure" },
  };

  let busy = false;
  let resetTimer = 0;

  function resizeCanvas() {
    if (!canvas || !stage) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function fireConfetti() {
    const burst = getStageConfetti();
    if (typeof burst !== "function") return;
    resizeCanvas();
    const x = 0.5;
    const y = 0.28;
    const confettiColors =
      Array.isArray(window.__rocketConfettiColors) && window.__rocketConfettiColors.length > 0
        ? window.__rocketConfettiColors
        : DEFAULT_CONFETTI_COLORS;
    burst({
      particleCount: 140,
      spread: 75,
      origin: { x, y },
      ticks: 220,
      gravity: 0.95,
      scalar: 1.05,
      colors: confettiColors,
    });
    setTimeout(() => {
      burst({
        particleCount: 60,
        angle: 60,
        spread: 55,
        origin: { x: x - 0.12, y: y + 0.05 },
        ticks: 180,
        colors: confettiColors,
      });
    }, 180);
    setTimeout(() => {
      burst({
        particleCount: 60,
        angle: 120,
        spread: 55,
        origin: { x: x + 0.12, y: y + 0.05 },
        ticks: 180,
        colors: confettiColors,
      });
    }, 320);
  }

  function setButtonsDisabled(disabled) {
    [btnGreat, btnMeh, btnFail].forEach((b) => {
      if (b) b.disabled = disabled;
    });
  }

  function resetToIdle() {
    if (!stage) return;
    stage.className =
      "rocket-stage-wrap rocket-stage rocket-stage--idle";
    statusEl.textContent = "";
    setButtonsDisabled(false);
    busy = false;
  }

  /**
   * @param {"great" | "meh" | "fail"} key
   */
  function playRocketScenario(key) {
    const cfg = SCENARIOS[key];
    if (!cfg || !stage || busy) return;

    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = 0;
    }

    busy = true;
    setButtonsDisabled(true);
    resizeCanvas();

    stage.className = `rocket-stage-wrap rocket-stage ${cfg.className}`;
    statusEl.innerHTML = `Animation: <strong>${cfg.label}</strong>`;

    if (key === "great") {
      setTimeout(fireConfetti, 650);
    }

    resetTimer = window.setTimeout(() => {
      resetTimer = 0;
      resetToIdle();
    }, cfg.durationMs);
  }

  btnGreat?.addEventListener("click", () => playRocketScenario("great"));
  btnMeh?.addEventListener("click", () => playRocketScenario("meh"));
  btnFail?.addEventListener("click", () => playRocketScenario("fail"));

  window.playRocketScenario = playRocketScenario;

  window.addEventListener("resize", () => {
    if (busy) resizeCanvas();
  });

  resizeCanvas();
})();
