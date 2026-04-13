/**
 * Kiosk leaderboard for /leaderboard (e.g. iPad Air). Polls /api/leaderboard.
 */

const POLL_MS = 8000;

const el = {
  empty: document.getElementById("lb-empty"),
  table: document.getElementById("lb-table"),
  list: document.getElementById("lb-list"),
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function formatDeviation(scoreMs) {
  const n = Number(scoreMs);
  if (!Number.isFinite(n)) return "+—";
  return `+${Math.round(n)}ms`;
}

async function fetchLeaderboard() {
  if (!el.empty || !el.list || !el.table) return;
  try {
    const res = await fetch("/api/leaderboard?limit=50", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const entries = [...(data.entries || [])].sort((a, b) => {
      const da = Number(a.score_ms);
      const db = Number(b.score_ms);
      const na = Number.isFinite(da) ? da : Infinity;
      const nb = Number.isFinite(db) ? db : Infinity;
      if (na !== nb) return na - nb;
      return String(a.submitted_at || "").localeCompare(String(b.submitted_at || ""));
    });
    if (entries.length === 0) {
      el.empty.hidden = false;
      el.table.hidden = true;
      return;
    }
    el.empty.hidden = true;
    el.table.hidden = false;
    el.list.replaceChildren();
    entries.forEach((row, i) => {
      const li = document.createElement("li");
      li.className = "lb-row";
      const name = row.display || "—";
      const dev = formatDeviation(row.score_ms);
      li.innerHTML = `
        <span class="lb-rank">#${i + 1}</span>
        <span class="lb-name" title="${escapeAttr(name)}">${escapeHtml(name)}</span>
        <span class="lb-dev">${escapeHtml(dev)}</span>
      `;
      el.list.appendChild(li);
    });
  } catch (_) {
    /* ignore */
  }
}

fetchLeaderboard();
setInterval(fetchLeaderboard, POLL_MS);
