const params = new URLSearchParams(window.location.search);
const tokenRaw = params.get("t");

const el = {
  scoreDisplay: document.getElementById("score-display"),
  fieldToken: document.getElementById("field-token"),
  form: document.getElementById("survey-form"),
  btnSubmit: document.getElementById("btn-submit"),
  msgError: document.getElementById("msg-error"),
  msgSuccess: document.getElementById("msg-success"),
};

async function loadTokenInfo() {
  if (tokenRaw == null || tokenRaw === "") {
    el.scoreDisplay.textContent = "ungültig oder fehlt";
    el.fieldToken.value = "";
    el.btnSubmit.disabled = true;
    return;
  }
  el.fieldToken.value = tokenRaw;
  try {
    const res = await fetch(`/api/survey-token-info?t=${encodeURIComponent(tokenRaw)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      el.scoreDisplay.textContent = "ungültig oder abgelaufen";
      el.fieldToken.value = "";
      el.btnSubmit.disabled = true;
      return;
    }
    const scoreMs = Number(data.score_ms);
    el.scoreDisplay.textContent = Number.isFinite(scoreMs)
      ? `${Math.round(scoreMs)} ms`
      : "—";
  } catch {
    el.scoreDisplay.textContent = "Konnte nicht geladen werden";
    el.fieldToken.value = "";
    el.btnSubmit.disabled = true;
  }
}

loadTokenInfo();

el.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  el.msgError.hidden = true;
  el.msgSuccess.hidden = true;

  const token = el.fieldToken.value.trim();
  const vorname = document.getElementById("field-vorname").value.trim();
  const nachname = document.getElementById("field-nachname").value.trim();
  const company = document.getElementById("field-company").value.trim();
  const email = document.getElementById("field-email").value.trim();

  if (!token) {
    el.msgError.textContent =
      "Ungültiges Ergebnis. Bitte den QR-Code vom Messe-Display scannen.";
    el.msgError.hidden = false;
    return;
  }

  el.btnSubmit.disabled = true;
  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        vorname,
        nachname,
        company,
        email,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      el.msgError.textContent =
        data.error === "name_fields_required"
          ? "Vorname, Nachname, Unternehmen und E-Mail sind Pflichtfelder."
          : data.error === "invalid_email"
            ? "Bitte gültige E-Mail eingeben."
            : data.error === "invalid_or_expired_token"
            ? "Das Ergebnis ist ungültig oder abgelaufen — bitte erneut spielen und QR scannen."
            : "Senden fehlgeschlagen. Bitte später erneut versuchen.";
      el.msgError.hidden = false;
      el.btnSubmit.disabled = false;
      return;
    }
    el.msgSuccess.textContent =
      "Danke! Du stehst in der Bestenliste, sobald die Seite aktualisiert wird.";
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
