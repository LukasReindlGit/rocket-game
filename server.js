"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const express = require("express");
const QRCode = require("qrcode");

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
      "submitted_at,name,email,nickname,score_ms,elapsed_ms\n",
      "utf8"
    );
  }
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

function readLeaderboard() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]);
  const idx = (name) => header.indexOf(name);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < header.length) continue;
    const row = {};
    header.forEach((h, j) => {
      row[h] = cols[j] ?? "";
    });
    const score = Number(row.score_ms);
    const elapsed = Number(row.elapsed_ms);
    if (!Number.isFinite(score)) continue;
    rows.push({
      submitted_at: row.submitted_at,
      name: row.name,
      email: row.email,
      nickname: row.nickname,
      score_ms: score,
      elapsed_ms: Number.isFinite(elapsed) ? elapsed : null,
    });
  }
  return rows;
}

function sortLeaderboard(rows) {
  return [...rows].sort((a, b) => {
    if (a.score_ms !== b.score_ms) return a.score_ms - b.score_ms;
    return String(a.submitted_at).localeCompare(String(b.submitted_at));
  });
}

function appendRow(row) {
  ensureDataFile();
  const line =
    [
      row.submitted_at,
      row.name,
      row.email,
      row.nickname,
      row.score_ms,
      row.elapsed_ms,
    ]
      .map(csvEscape)
      .join(",") + "\n";
  fs.appendFileSync(DATA_PATH, line, "utf8");
}

const app = express();
app.disable("x-powered-by");
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
    { width: 240, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } },
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

app.get("/api/leaderboard", (_req, res) => {
  try {
    const sorted = sortLeaderboard(readLeaderboard());
    const limit = Math.min(50, Math.max(1, Number(_req.query.limit) || 20));
    res.json({ entries: sorted.slice(0, limit) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "leaderboard_read_failed" });
  }
});

app.post("/api/submit", (req, res) => {
  const body = req.body || {};
  const name = String(body.name ?? "").trim().slice(0, 200);
  const email = String(body.email ?? "").trim().slice(0, 320);
  const nickname = String(body.nickname ?? "").trim().slice(0, 100);
  const score_ms = Number(body.score_ms);
  const elapsed_ms = body.elapsed_ms == null ? null : Number(body.elapsed_ms);

  if (!name || !email) {
    return res.status(400).json({ error: "name_and_email_required" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "invalid_email" });
  }
  if (!Number.isFinite(score_ms) || score_ms < 0 || score_ms > 120000) {
    return res.status(400).json({ error: "invalid_score" });
  }
  if (elapsed_ms != null && (!Number.isFinite(elapsed_ms) || elapsed_ms < 0)) {
    return res.status(400).json({ error: "invalid_elapsed" });
  }

  const submitted_at = new Date().toISOString();
  try {
    appendRow({
      submitted_at,
      name,
      email,
      nickname,
      score_ms: Math.round(score_ms),
      elapsed_ms:
        elapsed_ms == null || !Number.isFinite(elapsed_ms)
          ? ""
          : Math.round(elapsed_ms),
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
    console.log(`Marketing Time Game http://localhost:${listenPort}/game`);
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
