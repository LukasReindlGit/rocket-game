"use strict";

/**
 * Reusable leaderboard sidebar for minigames.
 *
 * Usage:
 *   const lb = new LbSidebar({
 *     listId:      "sidebar-lb-list",    // id of the <ol> element
 *     endpoint:    "/api/flappy/leaderboard",
 *     formatScore: (entry) => String(entry.score),  // optional
 *     pollMs:      12000,                // optional, default 12s
 *   });
 *   lb.start();
 *
 * Period tabs are automatically bound to any element with [data-lb-period]
 * attribute in the document (values: "all", "week", "day").
 */

function _lbEscHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

class LbSidebar {
  constructor({ listId, endpoint, formatScore, pollMs = 12000 }) {
    this.listEl      = document.getElementById(listId);
    this.endpoint    = endpoint;
    this.formatScore = formatScore || (e => String(e.score ?? e.score_ms ?? ""));
    this.pollMs      = pollMs;
    this.period      = "all";
    this._nick       = null;
    this._timerId    = null;
    this._bindTabs();
  }

  _bindTabs() {
    document.querySelectorAll("[data-lb-period]").forEach(btn => {
      btn.addEventListener("click", () => this.setPeriod(btn.dataset.lbPeriod));
    });
  }

  setPeriod(p) {
    this.period = p;
    document.querySelectorAll("[data-lb-period]").forEach(btn => {
      btn.classList.toggle("lb-tab--active", btn.dataset.lbPeriod === p);
    });
    this.poll(this._nick);
  }

  start() {
    this.poll(null);
    clearInterval(this._timerId);
    this._timerId = setInterval(() => this.poll(null), this.pollMs);
  }

  async poll(highlightNick = null) {
    if (highlightNick !== null) this._nick = highlightNick;
    const nick = this._nick;
    try {
      const res = await fetch(
        `${this.endpoint}?limit=10&period=${encodeURIComponent(this.period)}`
      );
      if (!res.ok) return;
      const { entries } = await res.json();
      this._render(entries, nick);
    } catch { /* silently ignore network errors */ }
  }

  _render(entries, highlightNick) {
    if (!this.listEl) return;
    if (!entries || entries.length === 0) {
      this.listEl.innerHTML = '<li class="sidebar-lb-empty">No scores yet — be first!</li>';
      return;
    }
    this.listEl.innerHTML = "";
    entries.forEach((e, i) => {
      const li   = document.createElement("li");
      const nick = e.nickname || e.display || "—";
      if (highlightNick && nick === highlightNick) li.classList.add("lb-you");
      li.innerHTML =
        `<span class="lb-sr">${i + 1}</span>` +
        `<span class="lb-sn">${_lbEscHtml(nick)}</span>` +
        `<span class="lb-ss">${_lbEscHtml(this.formatScore(e))}</span>`;
      this.listEl.appendChild(li);
    });
  }
}
