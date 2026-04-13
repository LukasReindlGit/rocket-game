/**
 * Redesign — /play: visible stopwatch, goal 10.000 s (display 10.00 s).
 * Space / Enter = buzzer. Uses same survey token + leaderboard API as /game.
 */

const TARGET_MS = 10000;

/** @type {'idle' | 'running' | 'postPlay'} */
let state = "idle";
let startMark = 0;
let lastElapsedMs = 0;
let lastScoreMs = 0;
let rafId = 0;

const el = {
  hit: document.getElementById("play-hit"),
  time: document.getElementById("play-time"),
  result: document.getElementById("play-result"),
  resultDelta: document.getElementById("play-result-delta"),
  resultElapsed: document.getElementById("play-result-elapsed"),
  qrHost: document.getElementById("play-qr-host"),
  qrBlock: document.getElementById("play-qr-block"),
  surveyLink: document.getElementById("play-survey-link"),
  surveyDetails: document.getElementById("play-survey-details"),
  surveyUrlFull: document.getElementById("play-survey-url-full"),
  surveyError: document.getElementById("play-survey-error"),
  btnAgain: document.getElementById("play-btn-again"),
};

/**
 * Seconds (two digits, zero-padded) + hundredths: SS.mm
 * @param {number} ms
 */
function formatStopwatch(ms) {
  const totalCs = Math.round(Math.max(0, ms) / 10);
  const wholeSec = Math.floor(totalCs / 100);
  const sub = totalCs % 100;
  return `${String(wholeSec).padStart(2, "0")}.${String(sub).padStart(2, "0")}`;
}

function tickLoop() {
  if (state !== "running") return;
  const elapsed = performance.now() - startMark;
  if (el.time) el.time.textContent = formatStopwatch(elapsed);
  rafId = requestAnimationFrame(tickLoop);
}

function setState(next) {
  state = next;
  if (state !== "running" && rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  if (state === "idle" && el.time) {
    el.time.textContent = "00.00";
  }
  if (el.hit) {
    el.hit.disabled = state === "postPlay";
    el.hit.setAttribute(
      "aria-label",
      state === "idle"
        ? "Timer starten"
        : state === "running"
          ? "Timer stoppen"
          : "Runde beendet"
    );
  }
  if (el.result) {
    el.result.hidden = state !== "postPlay";
  }
}

function isBuzzerKey(e) {
  return e.code === "Space" || e.code === "Enter";
}

/**
 * @param {Event | undefined} ev
 */
function onBuzzerAction(ev) {
  if (!ev || ev.isTrusted !== true) {
    return;
  }
  if (state === "postPlay") return;

  if (state === "idle") {
    startMark = performance.now();
    setState("running");
    rafId = requestAnimationFrame(tickLoop);
    return;
  }

  if (state === "running") {
    const elapsed = performance.now() - startMark;
    lastElapsedMs = elapsed;
    lastScoreMs = Math.round(Math.abs(elapsed - TARGET_MS));
    setState("postPlay");
    if (el.time) el.time.textContent = formatStopwatch(elapsed);
    if (el.resultDelta) el.resultDelta.textContent = `${lastScoreMs} ms daneben`;
    if (el.resultElapsed) {
      el.resultElapsed.textContent = `Gestoppt bei ${formatStopwatch(elapsed)}`;
    }
    showQrForScore(lastScoreMs, Math.round(elapsed));
    queueMicrotask(() => el.btnAgain?.focus({ preventScroll: true }));
  }
}

function resetSurveyUi() {
  if (el.surveyLink) {
    el.surveyLink.hidden = true;
    el.surveyLink.href = "#";
  }
  if (el.surveyDetails) el.surveyDetails.hidden = true;
  if (el.surveyUrlFull) el.surveyUrlFull.textContent = "";
  if (el.surveyError) {
    el.surveyError.hidden = true;
    el.surveyError.textContent = "";
  }
  if (el.qrBlock) el.qrBlock.hidden = true;
}

async function showQrForScore(scoreMs, elapsedRounded) {
  if (el.qrHost) el.qrHost.replaceChildren();
  resetSurveyUi();
  const base = `${window.location.origin}/survey`;
  let token;
  try {
    const r = await fetch("/api/mint-survey-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score_ms: scoreMs,
        elapsed_ms: elapsedRounded,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.token) {
      throw new Error("mint_failed");
    }
    token = data.token;
  } catch {
    if (el.surveyError) {
      el.surveyError.textContent =
        "Ergebnis konnte nicht signiert werden — bitte Seite neu laden und erneut spielen.";
      el.surveyError.hidden = false;
    }
    if (el.qrBlock) el.qrBlock.hidden = false;
    return;
  }
  const params = new URLSearchParams({ t: token });
  const url = `${base}?${params.toString()}`;
  if (el.surveyLink) {
    el.surveyLink.href = url;
    el.surveyLink.hidden = false;
  }
  if (el.surveyUrlFull) el.surveyUrlFull.textContent = url;
  if (el.surveyDetails) el.surveyDetails.hidden = false;

  const img = document.createElement("img");
  const qrPx = 480;
  img.width = qrPx;
  img.height = qrPx;
  img.alt = "QR-Code zum Formular";
  img.src = `/api/qr?u=${encodeURIComponent(url)}`;

  function revealQrBlock() {
    if (el.qrBlock) el.qrBlock.hidden = false;
  }
  img.addEventListener("load", revealQrBlock, { once: true });
  img.addEventListener("error", () => {
    if (el.qrHost) el.qrHost.replaceChildren();
    const p = document.createElement("p");
    p.className = "play-error";
    p.textContent = "QR konnte nicht geladen werden — Link unten öffnen.";
    el.qrHost?.appendChild(p);
    if (el.surveyDetails) el.surveyDetails.open = true;
    revealQrBlock();
  });
  el.qrHost?.appendChild(img);
  if (img.complete && img.naturalWidth > 0) {
    revealQrBlock();
  }
}

function onKeyDown(e) {
  if (!isBuzzerKey(e)) return;
  if (e.repeat) return;
  if (e.isTrusted !== true) return;
  if (state === "postPlay") return;
  e.preventDefault();
  onBuzzerAction(e);
}

if (el.hit) {
  el.hit.addEventListener("click", (e) => {
    e.preventDefault();
    onBuzzerAction(e);
  });
}
if (el.btnAgain) {
  el.btnAgain.addEventListener("click", (e) => {
    if (!e.isTrusted) {
      return;
    }
    setState("idle");
    if (el.qrHost) el.qrHost.replaceChildren();
    resetSurveyUi();
  });
}

window.addEventListener("keydown", onKeyDown);

setState("idle");
