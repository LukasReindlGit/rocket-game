const params = new URLSearchParams(window.location.search);
const timeRaw = params.get("time");
const elapsedRaw = params.get("elapsed");

const scoreMs = timeRaw != null && timeRaw !== "" ? Number(timeRaw) : NaN;
const elapsedMs = elapsedRaw != null && elapsedRaw !== "" ? Number(elapsedRaw) : null;

const el = {
  scoreDisplay: document.getElementById("score-display"),
  fieldScore: document.getElementById("field-score"),
  fieldElapsed: document.getElementById("field-elapsed"),
  form: document.getElementById("survey-form"),
  btnSubmit: document.getElementById("btn-submit"),
  msgError: document.getElementById("msg-error"),
  msgSuccess: document.getElementById("msg-success"),
};

if (!Number.isFinite(scoreMs) || scoreMs < 0) {
  el.scoreDisplay.textContent = "ungültig oder fehlt";
  el.fieldScore.value = "";
} else {
  el.scoreDisplay.textContent = `${Math.round(scoreMs)} ms`;
  el.fieldScore.value = String(Math.round(scoreMs));
}

if (elapsedMs != null && Number.isFinite(elapsedMs)) {
  el.fieldElapsed.value = String(Math.round(elapsedMs));
} else {
  el.fieldElapsed.value = "";
}

el.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  el.msgError.hidden = true;
  el.msgSuccess.hidden = true;

  const name = document.getElementById("field-name").value.trim();
  const email = document.getElementById("field-email").value.trim();
  const nickname = document.getElementById("field-nickname").value.trim();
  const score = Number(el.fieldScore.value);
  const elapsed =
    el.fieldElapsed.value === "" ? null : Number(el.fieldElapsed.value);

  if (!Number.isFinite(score) || score < 0) {
    el.msgError.textContent = "Ungültiges Ergebnis. Bitte erneut vom Kiosk-QR scannen.";
    el.msgError.hidden = false;
    return;
  }

  el.btnSubmit.disabled = true;
  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        nickname,
        score_ms: score,
        elapsed_ms: elapsed,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      el.msgError.textContent =
        data.error === "invalid_email"
          ? "Bitte gültige E-Mail eingeben."
          : data.error === "name_and_email_required"
            ? "Name und E-Mail sind Pflichtfelder."
            : "Senden fehlgeschlagen. Bitte später erneut versuchen.";
      el.msgError.hidden = false;
      return;
    }
    el.msgSuccess.textContent = "Danke! Du stehst in der Bestenliste, sobald die Seite aktualisiert wird.";
    el.msgSuccess.hidden = false;
    el.form.querySelectorAll("input:not([type=hidden])").forEach((inp) => {
      inp.disabled = true;
    });
    el.btnSubmit.disabled = true;
  } catch {
    el.msgError.textContent = "Netzwerkfehler. Bitte erneut versuchen.";
    el.msgError.hidden = false;
    el.btnSubmit.disabled = false;
  }
});
