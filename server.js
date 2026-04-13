"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const express = require("express");
const QRCode = require("qrcode");

const SURVEY_HMAC_SECRET =
  process.env.SURVEY_HMAC_SECRET ||
  "dev-survey-hmac-secret-change-in-production";
if (!process.env.SURVEY_HMAC_SECRET) {
  console.warn(
    "SURVEY_HMAC_SECRET is not set; using a dev default. Set the env var in production."
  );
}

const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Must match game logic: TARGET 10.000 s → score = |elapsed − 10s| (rounded). */
const GAME_TARGET_MS = 10000;

/**
 * @param {number} elapsedRounded
 * @returns {number}
 */
function expectedScoreMsFromElapsed(elapsedRounded) {
  return Math.round(Math.abs(elapsedRounded - GAME_TARGET_MS));
}

/** Simple sliding-window rate limit for POST /api/mint-survey-token (abuse / scripted mint). */
const MINT_RATE_WINDOW_MS = 60_000;
const MINT_RATE_MAX = 45;
const mintRateByIp = new Map();

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress || "unknown";
}

function allowMintRequest(ip) {
  const now = Date.now();
  let list = mintRateByIp.get(ip);
  if (!list) {
    list = [];
    mintRateByIp.set(ip, list);
  }
  while (list.length > 0 && now - list[0] > MINT_RATE_WINDOW_MS) {
    list.shift();
  }
  if (list.length >= MINT_RATE_MAX) {
    return false;
  }
  list.push(now);
  return true;
}

const explicitPort =
  Object.prototype.hasOwnProperty.call(process.env, "PORT") &&
  process.env.PORT !== "";
let listenPort = explicitPort ? Number(process.env.PORT) : 3000;
if (explicitPort && !Number.isFinite(listenPort)) {
  console.error("Invalid PORT environment variable.");
  process.exit(1);
}
const LISTEN_PORT_MAX = 3010;
const ROOT = __dirname;
const DATA_PATH = path.join(ROOT, "data", "leaderboard.csv");
const PUBLIC = path.join(ROOT, "public");
const CONTENT = path.join(ROOT, "content");

function ensureDataFile() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(
      DATA_PATH,
      "submitted_at,nickname,vorname,nachname,company,email,score_ms,elapsed_ms\n",
      "utf8"
    );
    return;
  }
  migrateLeaderboardCsvIfNeeded();
  migrateEmailColumnIfNeeded();
  migrateNicknameColumnIfNeeded();
}

/** Adds `nickname` column after `submitted_at` when missing. */
function migrateNicknameColumnIfNeeded() {
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return;
  const header = parseCSVLine(lines[0]);
  if (header.includes("nickname")) return;
  if (!header.includes("vorname")) return;

  const newHeader =
    "submitted_at,nickname,vorname,nachname,company,email,score_ms,elapsed_ms";
  const out = [newHeader];
  const idx = (name) => header.indexOf(name);
  const iSub = idx("submitted_at");
  const iVor = idx("vorname");
  const iNach = idx("nachname");
  const iComp = idx("company");
  const iEmail = idx("email");
  const iScore = idx("score_ms");
  const iEl = idx("elapsed_ms");
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const get = (j) => (j >= 0 ? cols[j] ?? "" : "");
    out.push(
      [
        get(iSub),
        "",
        get(iVor),
        get(iNach),
        get(iComp),
        get(iEmail),
        get(iScore),
        get(iEl),
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  fs.writeFileSync(DATA_PATH, out.join("\n") + "\n", "utf8");
}

function migrateLeaderboardCsvIfNeeded() {
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return;
  const header = parseCSVLine(lines[0]);
  if (header.includes("vorname")) return;

  const newHeader =
    "submitted_at,vorname,nachname,company,email,score_ms,elapsed_ms";
  const out = [newHeader];
  const idx = (name) => header.indexOf(name);
  const iName = idx("name");
  const iNick = idx("nickname");
  const iEmail = idx("email");
  const iSubmitted = idx("submitted_at");
  const iScore = idx("score_ms");
  const iElapsed = idx("elapsed_ms");
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const get = (j) => (j >= 0 ? cols[j] ?? "" : "");
    const oldName = get(iName);
    const nick = get(iNick);
    const vorname = oldName || nick || "—";
    const nachname = "";
    const company = "";
    const email = iEmail >= 0 ? get(iEmail) : "";
    out.push(
      [
        get(iSubmitted),
        vorname,
        nachname,
        company,
        email,
        get(iScore),
        get(iElapsed),
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  fs.writeFileSync(DATA_PATH, out.join("\n") + "\n", "utf8");
}

/** Adds `email` column after `company` when missing (older vorname-based CSV). */
function migrateEmailColumnIfNeeded() {
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return;
  const header = parseCSVLine(lines[0]);
  if (!header.includes("vorname") || header.includes("email")) return;

  const out = [
    "submitted_at,vorname,nachname,company,email,score_ms,elapsed_ms",
  ];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const row = {};
    header.forEach((h, j) => {
      row[h] = cols[j] ?? "";
    });
    out.push(
      [
        row.submitted_at,
        row.vorname,
        row.nachname,
        row.company,
        "",
        row.score_ms,
        row.elapsed_ms,
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  fs.writeFileSync(DATA_PATH, out.join("\n") + "\n", "utf8");
}

/**
 * @returns {{ score_ms: number, elapsed_ms: number | null } | null}
 */
function verifySurveyToken(tokenStr) {
  if (typeof tokenStr !== "string" || tokenStr.length < 10 || tokenStr.length > 4096) {
    return null;
  }
  const parts = tokenStr.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", SURVEY_HMAC_SECRET)
    .update(payloadB64)
    .digest("base64url");
  let sigBuf;
  let expBuf;
  try {
    sigBuf = Buffer.from(sig, "base64url");
    expBuf = Buffer.from(expectedSig, "base64url");
  } catch {
    return null;
  }
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (payload.v !== 1) return null;
  if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
  const score_ms = Number(payload.s);
  const elapsed_ms = payload.e == null ? null : Number(payload.e);
  if (!Number.isFinite(score_ms) || score_ms < 0 || score_ms > 120000) return null;
  if (elapsed_ms != null && (!Number.isFinite(elapsed_ms) || elapsed_ms < 0)) return null;
  if (elapsed_ms != null && Number.isFinite(elapsed_ms)) {
    if (elapsed_ms < 500 || elapsed_ms > 120000) return null;
    const exp = expectedScoreMsFromElapsed(elapsed_ms);
    if (Math.abs(Math.round(score_ms) - exp) > 1) return null;
  }
  return { score_ms: Math.round(score_ms), elapsed_ms: elapsed_ms == null ? null : Math.round(elapsed_ms) };
}

function mintSurveyToken(score_ms, elapsed_ms) {
  const iat = Date.now();
  const exp = iat + TOKEN_MAX_AGE_MS;
  const payload = {
    v: 1,
    s: Math.round(score_ms),
    e: elapsed_ms == null ? null : Math.round(elapsed_ms),
    iat,
    exp,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SURVEY_HMAC_SECRET)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

function csvEscape(value) {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function parseCSVLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Many CSV writers omit empty fields, so a row can have fewer columns than the
 * header (e.g. missing empty nachname). Align to header length so we do not skip rows.
 * When one column is missing, values shift left — insert "" before the email column:
 * first field containing "@" at index >= 4 (submitted_at, nickname, vorname, …).
 */
function alignLeaderboardColumns(cols, header) {
  const out = [...cols];
  if (out.length === header.length - 1) {
    const k = out.findIndex((c, i) => i >= 4 && String(c).includes("@"));
    if (k >= 4) {
      out.splice(k - 1, 0, "");
    }
  }
  while (out.length < header.length) {
    out.push("");
  }
  if (out.length > header.length) {
    out[header.length - 1] = out.slice(header.length - 1).join(",");
    out.length = header.length;
  }
  return out;
}

function readLeaderboard() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]);
  const idx = (name) => header.indexOf(name);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    let cols = alignLeaderboardColumns(parseCSVLine(lines[i]), header);
    if (cols.length < header.length) continue;
    const row = {};
    header.forEach((h, j) => {
      row[h] = cols[j] ?? "";
    });
    const score = Number(row.score_ms);
    const elapsed = Number(row.elapsed_ms);
    if (!Number.isFinite(score)) continue;
    const hasVorname = header.includes("vorname");
    const vorname = hasVorname ? row.vorname : row.name;
    const nachname = hasVorname ? row.nachname : "";
    const company = hasVorname ? row.company : "";
    const nickname = row.nickname || "";
    const display =
      nickname ||
      [vorname, nachname].filter(Boolean).join(" ").trim() ||
      row.name ||
      "—";
    rows.push({
      submitted_at: row.submitted_at,
      vorname,
      nachname,
      company,
      email: row.email ?? "",
      display,
      score_ms: score,
      elapsed_ms: Number.isFinite(elapsed) ? elapsed : null,
    });
  }
  return rows;
}

function sortLeaderboard(rows) {
  return [...rows].sort((a, b) => {
    const sa = Number(a.score_ms);
    const sb = Number(b.score_ms);
    const da = Number.isFinite(sa) ? sa : Infinity;
    const db = Number.isFinite(sb) ? sb : Infinity;
    if (da !== db) return da - db;
    return String(a.submitted_at).localeCompare(String(b.submitted_at));
  });
}

function appendRow(row) {
  ensureDataFile();
  const line =
    [
      row.submitted_at,
      row.nickname,
      row.vorname,
      row.nachname,
      row.company,
      row.email,
      row.score_ms,
      row.elapsed_ms,
    ]
      .map(csvEscape)
      .join(",") + "\n";
  fs.appendFileSync(DATA_PATH, line, "utf8");
}

const app = express();
app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "img-src 'self' data: blob: https:",
      "script-src 'self' https://cdn.jsdelivr.net",
      "style-src 'self' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "connect-src 'self'",
    ].join("; ")
  );
  next();
});

app.use(express.json({ limit: "32kb" }));
app.use("/content", express.static(CONTENT));

/**
 * PNG QR for survey URL (client passes full https URL in `u`).
 */
app.get("/api/qr", (req, res) => {
  const raw = req.query.u;
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 4096) {
    return res.status(400).end();
  }
  let text;
  try {
    text = decodeURIComponent(raw);
  } catch {
    return res.status(400).end();
  }
  if (!/^https?:\/\//i.test(text)) {
    return res.status(400).end();
  }
  QRCode.toBuffer(
    text,
    { width: 480, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } },
    (err, buf) => {
      if (err || !buf) {
        console.error(err);
        return res.status(500).end();
      }
      res.set("Cache-Control", "no-store");
      res.type("image/png");
      res.send(buf);
    }
  );
});

app.get("/", (_req, res) => {
  res.redirect(302, "/game");
});

app.get("/game", (_req, res) => {
  res.sendFile(path.join(PUBLIC, "game.html"));
});

app.get("/survey", (_req, res) => {
  res.sendFile(path.join(PUBLIC, "survey.html"));
});

app.get("/rocket", (_req, res) => {
  res.sendFile(path.join(PUBLIC, "rocket.html"));
});

/** Redesigned game (visible timer); original remains at /game */
app.get("/play", (_req, res) => {
  res.sendFile(path.join(PUBLIC, "play.html"));
});

/** Leaderboard kiosk (e.g. iPad); data from /api/leaderboard */
app.get("/leaderboard", (_req, res) => {
  res.sendFile(path.join(PUBLIC, "leaderboard.html"));
});

/**
 * Mint a signed survey URL token (score not readable without server secret).
 */
app.post("/api/mint-survey-token", (req, res) => {
  const ip = clientIp(req);
  if (!allowMintRequest(ip)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const body = req.body || {};
  const score_ms = Number(body.score_ms);
  const elapsed_ms = body.elapsed_ms == null ? null : Number(body.elapsed_ms);

  if (!Number.isFinite(score_ms) || score_ms < 0 || score_ms > 120000) {
    return res.status(400).json({ error: "invalid_score" });
  }
  if (elapsed_ms == null || !Number.isFinite(elapsed_ms)) {
    return res.status(400).json({ error: "elapsed_required" });
  }
  if (elapsed_ms < 500 || elapsed_ms > 120000) {
    return res.status(400).json({ error: "invalid_elapsed_range" });
  }

  const expected = expectedScoreMsFromElapsed(elapsed_ms);
  if (Math.abs(score_ms - expected) > 1) {
    return res.status(400).json({ error: "score_elapsed_mismatch" });
  }

  const token = mintSurveyToken(score_ms, elapsed_ms);
  res.json({ token });
});

/**
 * Verify token and return score for survey UI (no secret in browser).
 */
app.get("/api/survey-token-info", (req, res) => {
  const raw = req.query.t;
  if (typeof raw !== "string" || raw.length === 0) {
    return res.status(400).json({ error: "missing_token" });
  }
  const verified = verifySurveyToken(raw);
  if (!verified) {
    return res.status(400).json({ error: "invalid_or_expired_token" });
  }
  res.json({
    score_ms: verified.score_ms,
    elapsed_ms: verified.elapsed_ms,
  });
});

app.get("/api/leaderboard", (_req, res) => {
  try {
    const sorted = sortLeaderboard(readLeaderboard());
    const limit = Math.min(50, Math.max(1, Number(_req.query.limit) || 20));
    const entries = sorted.slice(0, limit).map((row) => ({
      submitted_at: row.submitted_at,
      display: row.display,
      score_ms: row.score_ms,
      elapsed_ms: row.elapsed_ms,
    }));
    res.setHeader("Cache-Control", "no-store");
    res.json({ entries });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "leaderboard_read_failed" });
  }
});

app.post("/api/submit", (req, res) => {
  const body = req.body || {};
  const token = String(body.token ?? "").trim();
  const nickname = String(body.nickname ?? "").trim().slice(0, 40);
  const vorname = String(body.vorname ?? "").trim().slice(0, 120);
  const nachname = String(body.nachname ?? "").trim().slice(0, 120);
  const company = String(body.company ?? "").trim().slice(0, 200);
  const email = String(body.email ?? "").trim().slice(0, 320);

  const verified = verifySurveyToken(token);
  if (!verified) {
    return res.status(400).json({ error: "invalid_or_expired_token" });
  }
  const { score_ms, elapsed_ms } = verified;

  if (!nickname || !vorname || !nachname || !company || !email) {
    return res.status(400).json({ error: "name_fields_required" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "invalid_email" });
  }

  const submitted_at = new Date().toISOString();
  try {
    appendRow({
      submitted_at,
      nickname,
      vorname,
      nachname,
      company,
      email,
      score_ms,
      elapsed_ms:
        elapsed_ms == null || !Number.isFinite(elapsed_ms)
          ? ""
          : elapsed_ms,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "write_failed" });
  }
});

app.use(express.static(PUBLIC));

app.use((_req, res) => {
  res.status(404).send("Not found");
});

ensureDataFile();

const server = http.createServer(app);

function tryListen() {
  server.listen(listenPort, () => {
    if (!explicitPort && listenPort !== 3000) {
      console.warn(
        `Port 3000 is already in use; listening on ${listenPort} instead.`
      );
    }
    const vHost = process.env.VIRTUAL_HOST;
    const primaryHost = vHost ? vHost.split(",")[0].trim() : "";
    const base = primaryHost ? `https://${primaryHost}` : `http://localhost:${listenPort}`;
    console.log(`Marketing Time Game ${base}/game  |  redesign ${base}/play  |  leaderboard ${base}/leaderboard`);
  });
}

server.on("error", (err) => {
  if (err.code !== "EADDRINUSE") {
    throw err;
  }
  if (explicitPort) {
    console.error(
      `Port ${listenPort} is already in use. Stop the other process or choose a different PORT, e.g. PORT=3001 npm start`
    );
    process.exit(1);
  }
  listenPort += 1;
  if (listenPort > LISTEN_PORT_MAX) {
    console.error(
      `No free port between 3000 and ${LISTEN_PORT_MAX}. Free a port or set PORT explicitly.`
    );
    process.exit(1);
  }
  tryListen();
});

tryListen();
