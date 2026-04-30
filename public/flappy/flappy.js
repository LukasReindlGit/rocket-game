"use strict";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GRAVITY          = 0.38;
const FLAP_VELOCITY    = -7.8;
const PIPE_SPEED       = 2.6;
const PIPE_WIDTH       = 90;
const PIPE_GAP         = 200;   // minimum vertical gap (px)
const BIRD_W           = 60;
const BIRD_H           = 51;
const BIRD_X_RATIO     = 0.22;
const GROUND_H         = 55;
const HITBOX_SHRINK    = 10;
const PIPE_HITBOX_SHRINK = 5;

// Debug: add ?debug=true to URL
const DEBUG = new URLSearchParams(window.location.search).get("debug") === "true";

// Asset paths — swap to retheme
const ASSET_BIRD_UP = "/flappy/assets/bird-up.svg";
const ASSET_BIRD_DN = "/flappy/assets/bird-down.svg";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let canvas, ctx;
let imgBirdUp, imgBirdDown;

let bird      = { y: 0, velocity: 0 };
let pipes     = [];   // { x, gapTop, gap, scored, singleSide, seed }
let score     = 0;
let pipeCount = 0;    // how many normal pipes have spawned this run
let gameState = "idle";
let animId    = null;
let lastPipeAt       = 0;
let nextPipeInterval = 0;
let lastFrame        = 0;

// Ambient visuals (generated once per canvas size)
let stars   = [];
let skyline = [];

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const screenStart       = document.getElementById("screen-start");
const screenGameover    = document.getElementById("screen-gameover");
const hudScore          = document.getElementById("hud-score");
const elFinalScore      = document.getElementById("final-score");
const nicknameInput     = document.getElementById("nickname-input");
const btnSubmit         = document.getElementById("btn-submit");
const btnPlayAgain      = document.getElementById("btn-play-again");
const submitSection     = document.getElementById("submit-section");
const submitError       = document.getElementById("submit-error");
const savedNotice       = document.getElementById("saved-notice");
const elReturnCountdown = document.getElementById("return-countdown");
const elCountdownSecs   = document.getElementById("countdown-secs");

// ---------------------------------------------------------------------------
// Asset loading
// ---------------------------------------------------------------------------
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function preloadAssets() {
  [imgBirdUp, imgBirdDown] = await Promise.all([
    loadImage(ASSET_BIRD_UP),
    loadImage(ASSET_BIRD_DN),
  ]);
}

// ---------------------------------------------------------------------------
// Canvas sizing
// ---------------------------------------------------------------------------
function resizeCanvas() {
  const c = canvas.parentElement;
  canvas.width  = c.clientWidth;
  canvas.height = c.clientHeight;
  buildStars();
  buildSkyline();
}

// ---------------------------------------------------------------------------
// Seeded pseudo-random (deterministic per pipe, doesn't flicker)
// ---------------------------------------------------------------------------
function seededRand(seed, idx = 0) {
  let h = ((seed * 2654435761 + idx * 1234567891) | 0) >>> 0;
  h ^= h >>> 16;
  h  = Math.imul(h, 0x45d9f3b) >>> 0;
  h ^= h >>> 16;
  return h / 0xffffffff;
}

// ---------------------------------------------------------------------------
// Ambient: stars & distant skyline
// ---------------------------------------------------------------------------
function buildStars() {
  stars = [];
  for (let i = 0; i < 120; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * (canvas.height * 0.72),
      r: Math.random() < 0.75 ? 1 : 1.5,
      b: 0.25 + Math.random() * 0.65,
    });
  }
}

function buildSkyline() {
  skyline = [];
  let x = 0;
  let seed = 9371;
  while (x < canvas.width) {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    const w = 24 + (seed % 38);
    const h = 28 + ((seed >> 5) % 90);
    skyline.push({ x, w, h });
    x += w + 3;
  }
}

// ---------------------------------------------------------------------------
// Difficulty scaling
// ---------------------------------------------------------------------------
function getSpawnInterval() {
  // Starts at ~3200 ms, narrows to ~1600 ms over first 15 pipes, ±25% random variation
  const base = Math.max(1600, 3200 - pipeCount * 106);
  return Math.max(1400, base + (Math.random() * 2 - 1) * base * 0.25);
}

function getPipeGap() {
  // Starts at ~300 px, narrows to PIPE_GAP (200) over first 20 pipes, ±40 px variation
  const base = Math.max(PIPE_GAP, 300 - pipeCount * 5);
  return Math.max(PIPE_GAP, base + (Math.random() * 2 - 1) * 40);
}

// ---------------------------------------------------------------------------
// Game lifecycle
// ---------------------------------------------------------------------------
function resetGame() {
  bird      = { y: canvas.height * 0.42, velocity: 0 };
  pipes     = [];
  score     = 0;
  pipeCount = 0;
  nextPipeInterval = 3200;
  lastPipeAt = 0;
  lastFrame  = 0;
  hudScore.textContent = "0";
}

function startGame() {
  clearGameOverCountdown();
  resetGame();
  gameState = "playing";

  screenStart.hidden    = true;
  screenGameover.hidden = true;
  hudScore.hidden       = false;

  const now = performance.now();
  lastFrame  = now;
  lastPipeAt = now;

  spawnFirstPipe();

  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
// Game-over countdown (auto-return to title after 60 s)
// ---------------------------------------------------------------------------
let gameOverTimerId = null;

function startGameOverCountdown() {
  clearGameOverCountdown();
  let secs = 60;
  if (elCountdownSecs) elCountdownSecs.textContent = String(secs);
  if (elReturnCountdown) elReturnCountdown.hidden = false;
  gameOverTimerId = setInterval(() => {
    secs--;
    if (elCountdownSecs) elCountdownSecs.textContent = String(secs);
    if (secs <= 0) returnToTitle();
  }, 1000);
}

function clearGameOverCountdown() {
  clearInterval(gameOverTimerId);
  gameOverTimerId = null;
  if (elReturnCountdown) elReturnCountdown.hidden = true;
}

function returnToTitle() {
  clearGameOverCountdown();
  gameState = "idle";
  screenGameover.hidden = true;
  screenStart.hidden    = false;
  requestAnimationFrame(drawIdleFrame);
}

function endGame() {
  gameState = "dead";
  cancelAnimationFrame(animId);
  hudScore.hidden = true;

  elFinalScore.textContent = String(score);
  submitSection.hidden  = false;
  savedNotice.hidden    = true;
  submitError.hidden    = true;
  nicknameInput.value   = "";
  btnSubmit.disabled    = false;
  btnSubmit.textContent = "Save";
  screenGameover.hidden = false;
  nicknameInput.focus();

  lbSidebar.poll(null);
  startGameOverCountdown();
}

// ---------------------------------------------------------------------------
// Input — tap / click / spacebar
// ---------------------------------------------------------------------------
function onInput(e) {
  if (e.target && e.target !== canvas &&
      (e.target.tagName === "BUTTON" || e.target.tagName === "INPUT" || e.target.tagName === "A")) {
    return;
  }
  if (gameState === "idle") { startGame(); return; }
  if (gameState === "dead")  { startGame(); return; }
  if (gameState === "playing") { bird.velocity = FLAP_VELOCITY; }
}

document.addEventListener("pointerdown", onInput);
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
    e.preventDefault();
    onInput(e);
  }
});

// ---------------------------------------------------------------------------
// Pipe spawning
// ---------------------------------------------------------------------------
function spawnPipe(now, { singleSide = null, atX = null, forcedGap = null } = {}) {
  const gap    = forcedGap ?? getPipeGap();
  const minTop = 80;
  const maxTop = canvas.height - GROUND_H - gap - 80;
  const gapTop = minTop + Math.random() * Math.max(0, maxTop - minTop);
  const seed   = Math.floor(Math.random() * 99999);
  pipes.push({ x: atX ?? canvas.width + 10, gapTop, gap, scored: false, singleSide, seed });
  if (now !== null) {
    pipeCount++;
    lastPipeAt = now;
    nextPipeInterval = getSpawnInterval();
  }
}

function spawnFirstPipe() {
  const side = Math.random() < 0.5 ? "top" : "bottom";
  spawnPipe(null, { singleSide: side, atX: canvas.width + 80, forcedGap: 310 });
}

// ---------------------------------------------------------------------------
// Collision helpers
// ---------------------------------------------------------------------------
function birdHitbox() {
  const bx = canvas.width * BIRD_X_RATIO;
  return {
    x: bx - BIRD_W / 2 + HITBOX_SHRINK,
    y: bird.y  - BIRD_H / 2 + HITBOX_SHRINK,
    w: BIRD_W  - HITBOX_SHRINK * 2,
    h: BIRD_H  - HITBOX_SHRINK * 2,
  };
}

function pipeHitboxes(p) {
  const px   = p.x + PIPE_HITBOX_SHRINK;
  const pw   = PIPE_WIDTH - PIPE_HITBOX_SHRINK * 2;
  const boxes = [];
  if (p.singleSide !== "bottom") boxes.push({ x: px, y: 0, w: pw, h: p.gapTop });
  if (p.singleSide !== "top") {
    const botY = p.gapTop + p.gap;
    boxes.push({ x: px, y: botY, w: pw, h: canvas.height - botY });
  }
  return boxes;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function checkCollisions() {
  const hb = birdHitbox();
  if (bird.y + BIRD_H / 2 >= canvas.height - GROUND_H) return true;
  if (bird.y - BIRD_H / 2 <= 0) return true;
  for (const p of pipes) {
    for (const box of pipeHitboxes(p)) {
      if (rectsOverlap(hb, box)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
function update(now) {
  const dt = Math.min((now - lastFrame) / (1000 / 60), 3);
  lastFrame = now;

  bird.velocity += GRAVITY * dt;
  bird.y        += bird.velocity * dt;

  if (now - lastPipeAt >= nextPipeInterval) spawnPipe(now);

  const bx = canvas.width * BIRD_X_RATIO;
  for (const p of pipes) {
    p.x -= PIPE_SPEED * dt;
    if (!p.scored && p.x + PIPE_WIDTH < bx) {
      p.scored = true;
      score++;
      hudScore.textContent = String(score);
    }
  }
  pipes = pipes.filter((p) => p.x > -(PIPE_WIDTH + 20));

  if (checkCollisions()) endGame();
}

// ---------------------------------------------------------------------------
// Drawing — Night cyberpunk world
// ---------------------------------------------------------------------------
function drawNightBackground() {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height - GROUND_H);
  sky.addColorStop(0,    "#001950");
  sky.addColorStop(0.5,  "#07154e");
  sky.addColorStop(1,    "#263172");
  // sky.addColorStop(0,    "#000510");
  // sky.addColorStop(0.5,  "#030920");
  // sky.addColorStop(1,    "#070428");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height - GROUND_H);

  // Stars
  for (const s of stars) {
    ctx.globalAlpha = s.b;
    ctx.fillStyle   = "#ffffff";
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;

  // Distant city silhouette
  const baseY = canvas.height - GROUND_H;
  ctx.fillStyle = "#1a233f";
  for (const b of skyline) {
    ctx.fillRect(b.x, baseY - b.h, b.w, b.h);
  }
  // Sparse lit windows on distant buildings
  for (const b of skyline) {
    if (b.h < 40) continue;
    for (let wy = baseY - b.h + 8; wy < baseY - 8; wy += 14) {
      for (let wx = b.x + 3; wx < b.x + b.w - 6; wx += 10) {
        if (((wx * 7 + wy * 13) & 0xff) < 35) {
          ctx.fillStyle = "rgba(255,220,80,0.22)";
          ctx.fillRect(wx, wy, 5, 7);
        }
      }
    }
  }

  // Horizon glow
  const hg = ctx.createLinearGradient(0, baseY - 45, 0, baseY);
  hg.addColorStop(0, "rgba(0,180,255,0)");
  hg.addColorStop(1, "rgba(0,180,255,0.1)");
  ctx.fillStyle = hg;
  ctx.fillRect(0, baseY - 45, canvas.width, 45);

  // Ground
  ctx.fillStyle = "#04080e";
  ctx.fillRect(0, baseY, canvas.width, GROUND_H);

  // Neon ground line
  ctx.shadowColor = "#00d4ff";
  ctx.shadowBlur  = 10;
  ctx.fillStyle   = "#00d4ff";
  ctx.fillRect(0, baseY, canvas.width, 2);
  ctx.shadowBlur  = 0;
}

// Building (bottom pipe)
function drawBuilding(x, topY, w, h, seed) {
  // Facade
  // ctx.fillStyle = "#040a18";
  ctx.fillStyle = "#2a2c30";
  ctx.fillRect(x, topY, w, h);

  // Rooftop overhang
  ctx.fillStyle = "#262c3d";
  // ctx.fillStyle = "#0b1530";
  ctx.fillRect(x - 4, topY, w + 8, 10);

  // Rooftop antenna
  if (seededRand(seed, 200) > 0.45) {
    const ax = x + Math.floor(w * 0.5);
    ctx.fillStyle = "#182040";
    ctx.fillRect(ax - 1, topY - 14, 2, 14);
    ctx.fillStyle = seededRand(seed, 201) > 0.5 ? "#ff3333" : "#ff9900";
    ctx.fillRect(ax - 2, topY - 17, 4, 4);
  }

  // Windows
  const winW = 8, winH = 11, gapX = 6, gapY = 7, padX = 8, padY = 14;
  const cols = Math.max(1, Math.floor((w - padX * 2) / (winW + gapX)));
  let idx = 0;
  for (let wy = topY + padY; wy + winH < topY + h - 4; wy += winH + gapY) {
    for (let c = 0; c < cols; c++) {
      const wx = x + padX + c * (winW + gapX);
      const r  = seededRand(seed, idx);
      if (r > 0.28) {
        ctx.fillStyle = r > 0.95 ? "#00ffcc" : (r > 0.82 ? "#ff8030" : "#ffd060");
      } else {
        ctx.fillStyle = "#020406";
      }
      ctx.fillRect(wx, wy, winW, winH);
      idx++;
    }
  }

  // Neon sign stripe
  const stripeY = topY + padY + Math.floor(seededRand(seed, 99) * 28);
  const neon    = seededRand(seed, 77) > 0.5 ? "#ff00cc" : "#00ccff";
  ctx.shadowColor = neon;
  ctx.shadowBlur  = 8;
  ctx.fillStyle   = neon;
  ctx.fillRect(x + 3, stripeY, w - 6, 2);
  ctx.shadowBlur  = 0;
}

// Hanging screen / grate (top pipe)
function drawHangingScreen(x, gapTop, w, seed) {
  const screenH    = Math.min(Math.max(64, gapTop * 0.38), 92);
  const screenTopY = gapTop - screenH;
  const neon       = seededRand(seed, 0) > 0.5 ? "#ff00cc" : "#00bbff";

  // deprecated
  // Dark void behind cables (ensure sky doesn't bleed weirdly)
  // ctx.fillStyle = "#020510";
  // ctx.fillRect(x + PIPE_HITBOX_SHRINK, 0, w - PIPE_HITBOX_SHRINK * 2, screenTopY);

  // Chain segments
  const c1x = x + Math.floor(w * 0.28);
  const c2x = x + Math.floor(w * 0.72);
  ctx.strokeStyle = "#2e3049";
  ctx.lineWidth   = 2;
  for (let cy = 0; cy < screenTopY - 2; cy += 9) {
    ctx.strokeRect(c1x - 2, cy, 5, 7);
    ctx.strokeRect(c2x - 2, cy, 5, 7);
  }

  // Screen body
  ctx.fillStyle = "#505f99";
  ctx.fillRect(x, screenTopY, w, screenH);

  // Glowing border
  ctx.shadowColor = neon;
  ctx.shadowBlur  = 12;
  ctx.strokeStyle = neon;
  ctx.lineWidth   = 2;
  ctx.strokeRect(x + 1, screenTopY + 1, w - 2, screenH - 2);
  ctx.shadowBlur  = 0;

  // Ad content lines
  ctx.fillStyle   = neon;
  ctx.globalAlpha = 0.55;
  const pad = 8;
  let ly = screenTopY + pad, li = 0;
  while (ly + 3 < screenTopY + screenH - pad) {
    const lw = (w - pad * 2) * (0.3 + seededRand(seed, li + 50) * 0.7);
    ctx.fillRect(x + pad, ly, lw, 3);
    ly += 9;
    li++;
  }
  ctx.globalAlpha = 1;
}

function drawCyberpunkPipes() {
  for (const p of pipes) {
    const topH = p.gapTop;
    const botY = p.gapTop + p.gap;
    const botH = canvas.height - GROUND_H - botY;

    if (p.singleSide !== "bottom" && topH > 0) drawHangingScreen(p.x, topH, PIPE_WIDTH, p.seed);
    if (p.singleSide !== "top"    && botH > 0) drawBuilding(p.x, botY, PIPE_WIDTH, botH, p.seed);
  }
}

function drawBird() {
  const bx  = canvas.width * BIRD_X_RATIO;
  const img = bird.velocity < 0 ? imgBirdUp : imgBirdDown;
  const deg = Math.max(-25, Math.min(70, bird.velocity * 4.5));
  const rad = (deg * Math.PI) / 180;

  ctx.save();
  ctx.translate(bx, bird.y);
  ctx.rotate(rad);
  if (img) {
    ctx.drawImage(img, -BIRD_W / 2, -BIRD_H / 2, BIRD_W, BIRD_H);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_W / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#fde047";
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Debug overlay
// ---------------------------------------------------------------------------
function drawDebug() {
  const hb = birdHitbox();
  const bx = canvas.width * BIRD_X_RATIO;
  ctx.save();
  ctx.lineWidth = 2;

  // Bird sprite bound (dashed yellow)
  ctx.strokeStyle = "rgba(255,220,0,0.55)";
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(bx - BIRD_W / 2, bird.y - BIRD_H / 2, BIRD_W, BIRD_H);
  ctx.setLineDash([]);

  // Bird hitbox (red)
  ctx.fillStyle   = "rgba(255,60,60,0.22)";
  ctx.strokeStyle = "rgba(255,60,60,0.95)";
  ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
  ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);

  // Pipe hitboxes (blue) and gap (green)
  for (const p of pipes) {
    ctx.fillStyle = "rgba(60,255,120,0.1)";
    ctx.fillRect(p.x + PIPE_HITBOX_SHRINK, p.gapTop, PIPE_WIDTH - PIPE_HITBOX_SHRINK * 2, p.gap);

    ctx.fillStyle   = "rgba(60,140,255,0.16)";
    ctx.strokeStyle = "rgba(60,140,255,0.9)";
    for (const box of pipeHitboxes(p)) {
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.strokeRect(box.x, box.y, box.w, box.h);
    }
  }

  // Kill lines
  ctx.strokeStyle = "rgba(255,160,0,0.8)";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height - GROUND_H);
  ctx.lineTo(canvas.width, canvas.height - GROUND_H);
  ctx.moveTo(0, 0);
  ctx.lineTo(canvas.width, 0);
  ctx.stroke();

  // Badge
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(8, 8, 78, 24);
  ctx.fillStyle    = "#ff5050";
  ctx.font         = "bold 13px monospace";
  ctx.textBaseline = "middle";
  ctx.fillText("⬛ DEBUG", 14, 21);

  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawNightBackground();
  drawCyberpunkPipes();
  drawBird();
  if (DEBUG) drawDebug();
}

// ---------------------------------------------------------------------------
// Main loop & idle animation
// ---------------------------------------------------------------------------
function loop(now) {
  update(now);
  render();
  if (gameState === "playing") animId = requestAnimationFrame(loop);
}

function drawIdleFrame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawNightBackground();
  bird.y = canvas.height * 0.42 + Math.sin(performance.now() / 420) * 9;
  drawBird();
  if (gameState === "idle") requestAnimationFrame(drawIdleFrame);
}

// ---------------------------------------------------------------------------
// Sidebar leaderboard (powered by shared LbSidebar component)
// ---------------------------------------------------------------------------
const lbSidebar = new LbSidebar({
  listId:      "sidebar-lb-list",
  endpoint:    "/api/flappy/leaderboard",
  formatScore: (e) => String(e.score),
});

// ---------------------------------------------------------------------------
// Score submission
// ---------------------------------------------------------------------------
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function submitScore(nickname) {
  const res = await fetch("/api/flappy/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, score }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "submit_failed");
  }
  return res.json();
}

btnSubmit.addEventListener("click", async () => {
  const nickname = nicknameInput.value.trim();
  if (!nickname) { showSubmitError("Please enter a nickname."); return; }

  btnSubmit.disabled    = true;
  btnSubmit.textContent = "Saving…";
  submitError.hidden    = true;
  try {
    await submitScore(nickname);
    submitSection.hidden = true;
    savedNotice.hidden   = false;
    clearGameOverCountdown();
    lbSidebar.poll(nickname);
  } catch (err) {
    showSubmitError(humaniseError(err.message));
    btnSubmit.disabled    = false;
    btnSubmit.textContent = "Save";
  }
});

nicknameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") btnSubmit.click(); });
btnPlayAgain.addEventListener("click", () => { screenGameover.hidden = true; startGame(); });

function showSubmitError(msg) { submitError.textContent = msg; submitError.hidden = false; }

function humaniseError(code) {
  return ({
    nickname_required:     "Nickname is required.",
    nickname_too_long:     "Nickname must be 30 characters or fewer.",
    invalid_score:         "Invalid score — please play the game first.",
    inappropriate_content: "That nickname isn't allowed. Try another.",
  })[code] || "Something went wrong. Please try again.";
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
canvas = document.getElementById("game-canvas");
ctx    = canvas.getContext("2d");

resizeCanvas();
window.addEventListener("resize", () => {
  resizeCanvas();
  if (gameState === "idle") bird.y = canvas.height * 0.42;
});

preloadAssets().then(() => {
  bird.y = canvas.height * 0.42;
  requestAnimationFrame(drawIdleFrame);
});

lbSidebar.start();
