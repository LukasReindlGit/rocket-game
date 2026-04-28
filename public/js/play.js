/**
 * /play — fullscreen layout from example.html; goal 10.000 s.
 * Space / Enter / K = buzzer. Survey token + leaderboard API same as /game.
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
  header: document.getElementById("play-header"),
  center: document.getElementById("play-center"),
  time: document.getElementById("play-time"),
  timeLabel: document.getElementById("play-time-label"),
  resultMeta: document.getElementById("play-result-meta"),
  resultDelta: document.getElementById("play-result-delta"),
  resultSub: document.getElementById("play-result-sub"),
  resultElapsed: document.getElementById("play-result-elapsed"),
  bottom: document.getElementById("play-bottom"),
  copyPlaying: document.getElementById("play-copy-playing"),
  copyResult: document.getElementById("play-copy-result"),
  qrCol: document.getElementById("play-qr-col"),
  qrHost: document.getElementById("play-qr-host"),
  qrBlock: document.getElementById("play-qr-block"),
  surveyLink: document.getElementById("play-survey-link"),
  surveyDetails: document.getElementById("play-survey-details"),
  surveyUrlFull: document.getElementById("play-survey-url-full"),
  surveyError: document.getElementById("play-survey-error"),
  btnAgain: document.getElementById("play-btn-again"),
};

/**
 * Seconds (two digits, zero-padded) + milliseconds: SS.mmm
 * @param {number} ms
 */
function formatStopwatch(ms) {
  const rounded = Math.round(Math.max(0, ms));
  const wholeSec = Math.floor(rounded / 1000);
  const frac = rounded % 1000;
  return `${String(wholeSec).padStart(2, "0")}.${String(frac).padStart(3, "0")}`;
}

/**
 * Delta from 10.000 s target, e.g. "+0.014 s" / "−0.020 s" (Unicode minus).
 * @param {number} elapsedMs
 */
function formatDeltaFromTarget(elapsedMs) {
  const deltaSec = (Math.round(Math.max(0, elapsedMs)) - TARGET_MS) / 1000;
  const sign = deltaSec >= 0 ? "+" : "\u2212";
  const abs = Math.abs(deltaSec);
  return `${sign}${abs.toFixed(3)} s`;
}

function tickLoop() {
  if (state !== "running") return;
  const elapsed = performance.now() - startMark;
  if (el.time) el.time.textContent = formatStopwatch(elapsed);
  rafId = requestAnimationFrame(tickLoop);
}

function syncPhaseUi() {
  const isResult = state === "postPlay";
  if (el.header) {
    el.header.textContent = isResult ? "Result" : "10 seconds";
  }
  if (el.center) {
    el.center.classList.toggle("is-playing", !isResult);
  }
  if (el.timeLabel) {
    el.timeLabel.textContent = isResult ? "Your time" : "Start & stop";
  }
  if (el.resultMeta) {
    el.resultMeta.hidden = !isResult;
  }
  if (el.resultDelta) {
    el.resultDelta.setAttribute("aria-hidden", isResult ? "false" : "true");
    if (!isResult) el.resultDelta.textContent = "";
  }
  if (el.copyPlaying) {
    el.copyPlaying.hidden = isResult;
  }
  if (el.copyResult) {
    el.copyResult.hidden = !isResult;
  }
  if (el.qrCol) {
    el.qrCol.hidden = !isResult;
  }
  if (el.bottom) {
    el.bottom.classList.toggle("bottom--solo", !isResult);
  }
}

function setState(next) {
  state = next;
  if (state !== "running" && rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  if (state === "idle" && el.time) {
    el.time.textContent = "00.000";
  }
  if (el.hit) {
    el.hit.disabled = state === "postPlay";
    el.hit.setAttribute(
      "aria-label",
      state === "idle"
        ? "Start timer"
        : state === "running"
          ? "Stop timer"
          : "Round finished"
    );
  }
  syncPhaseUi();
}

function isBuzzerKey(e) {
  return e.code === "Space" || e.code === "Enter" || e.code === "KeyK";
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
    if (el.resultDelta) el.resultDelta.textContent = formatDeltaFromTarget(Math.round(elapsed));
    if (el.resultElapsed) {
      el.resultElapsed.textContent = `Stopped at ${formatStopwatch(elapsed)} (${formatDeltaFromTarget(Math.round(elapsed))} from target).`;
    }
    showQrForScore(lastScoreMs, Math.round(elapsed));
    queueMicrotask(() => el.btnAgain?.focus({ preventScroll: true }));
  }
}

/**
 * @param {Event | undefined} ev
 */
function playAgainFromTrusted(ev) {
  if (!ev || ev.isTrusted !== true) {
    return;
  }
  setState("idle");
  if (el.qrHost) el.qrHost.replaceChildren();
  if (el.resultElapsed) el.resultElapsed.textContent = "";
  resetSurveyUi();
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
        "Could not sign your result — please reload the page and try again.";
      el.surveyError.hidden = false;
    }
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
  img.alt = "QR code to registration form";
  img.src = `/api/qr?u=${encodeURIComponent(url)}`;

  function revealQrBlock() {
    if (el.qrBlock) el.qrBlock.hidden = false;
  }
  img.addEventListener("load", revealQrBlock, { once: true });
  img.addEventListener("error", () => {
    if (el.qrHost) el.qrHost.replaceChildren();
    const p = document.createElement("p");
    p.className = "play-error";
    p.textContent = "QR image failed to load — use the link below.";
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
  if (state === "postPlay") {
    e.preventDefault();
    playAgainFromTrusted(e);
    return;
  }
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
  el.btnAgain.addEventListener("click", playAgainFromTrusted);
}

window.addEventListener("keydown", onKeyDown);

setState("idle");
