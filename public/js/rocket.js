"use strict";

(function () {
  const CONFETTI_VAR_COUNT = 6;
  const CONFETTI_FALLBACK = ["#fde047", "#4ade80", "#38bdf8", "#f472b6", "#a78bfa", "#fb923c"];

  /** @type {HTMLElement | null} */
  let stage = null;
  /** @type {HTMLElement | null} */
  let statusEl = null;
  /** @type {HTMLButtonElement | null} */
  let btnGreat = null;
  /** @type {HTMLButtonElement | null} */
  let btnMeh = null;
  /** @type {HTMLButtonElement | null} */
  let btnFail = null;
  /** @type {HTMLCanvasElement | null} */
  let canvas = null;

  let busy = false;
  let resetTimer = 0;

  const SCENARIOS = {
    great: { className: "rocket-stage--great", durationMs: 4700, label: "Great success!" },
    meh: { className: "rocket-stage--meh", durationMs: 3600, label: "Meh!" },
    fail: { className: "rocket-stage--fail", durationMs: 3800, label: "Failure" },
  };

  /**
   * Confetti colors come from `rocket-theme.css` (--rocket-confetti-0 …) so they stay editable as CSS.
   * @returns {string[]}
   */
  function confettiColorsFromTheme() {
    const root = document.body;
    if (!root) {
      return CONFETTI_FALLBACK;
    }
    const styles = getComputedStyle(root);
    const out = [];
    for (let i = 0; i < CONFETTI_VAR_COUNT; i++) {
      const v = styles.getPropertyValue(`--rocket-confetti-${i}`).trim();
      if (v) {
        out.push(v);
      }
    }
    return out.length > 0 ? out : CONFETTI_FALLBACK;
  }

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
    const confettiColors = confettiColorsFromTheme();
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
    stage.className = "rocket-stage-wrap rocket-stage rocket-stage--idle";
    if (statusEl) statusEl.textContent = "";
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
    if (statusEl) {
      statusEl.innerHTML = `Animation: <strong>${cfg.label}</strong>`;
    }

    if (key === "great") {
      setTimeout(fireConfetti, 650);
    }

    resetTimer = window.setTimeout(() => {
      resetTimer = 0;
      busy = false;
      setButtonsDisabled(false);
      if (statusEl) statusEl.textContent = "";
      /* Keep `stage` on scenario class so the last animation frame stays visible until resetRocketStage() (e.g. game start screen). */
    }, cfg.durationMs);
  }

  function resetRocketStage() {
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = 0;
    }
    resetToIdle();
    resizeCanvas();
  }

  /**
   * Wire rocket DOM under `scope` (container that holds `#rocket-stage` after injecting the partial).
   * Demo page buttons use document-wide ids `btn-great` / `btn-meh` / `btn-fail`; optional `#rocket-status` for captions.
   * @param {ParentNode} scope
   */
  function mountRocketStage(scope) {
    if (!scope || typeof scope.querySelector !== "function") return;

    stage = scope.querySelector("#rocket-stage");
    canvas = scope.querySelector("#confetti-canvas");
    statusEl = document.getElementById("rocket-status");

    btnGreat = document.getElementById("btn-great");
    btnMeh = document.getElementById("btn-meh");
    btnFail = document.getElementById("btn-fail");

    if (!stage || !canvas) return;

    btnGreat?.addEventListener("click", () => playRocketScenario("great"));
    btnMeh?.addEventListener("click", () => playRocketScenario("meh"));
    btnFail?.addEventListener("click", () => playRocketScenario("fail"));

    resizeCanvas();
  }

  window.mountRocketStage = mountRocketStage;
  window.playRocketScenario = playRocketScenario;
  window.resetRocketStage = resetRocketStage;

  window.addEventListener("resize", () => {
    if (stage) resizeCanvas();
  });
})();

