"use strict";

(function () {
  const stage = document.getElementById("rocket-stage");
  const statusEl = document.getElementById("rocket-status");
  const btnGreat = document.getElementById("btn-great");
  const btnMeh = document.getElementById("btn-meh");
  const btnFail = document.getElementById("btn-fail");
  const canvas = document.getElementById("confetti-canvas");

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
    if (typeof confetti !== "function" || !canvas) return;
    const rect = stage.getBoundingClientRect();
    const x = 0.5;
    const y = 0.28;
    confetti({
      particleCount: 140,
      spread: 75,
      origin: { x, y },
      ticks: 220,
      gravity: 0.95,
      scalar: 1.05,
      colors: ["#fde047", "#4ade80", "#38bdf8", "#f472b6", "#a78bfa", "#fb923c"],
      canvas,
    });
    setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 60,
        spread: 55,
        origin: { x: x - 0.12, y: y + 0.05 },
        ticks: 180,
        canvas,
      });
    }, 180);
    setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 120,
        spread: 55,
        origin: { x: x + 0.12, y: y + 0.05 },
        ticks: 180,
        canvas,
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
