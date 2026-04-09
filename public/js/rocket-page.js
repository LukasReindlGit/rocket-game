"use strict";

/**
 * Loads the shared rocket stage partial into `#rocket-stage-root` (rocket demo page).
 */
(function () {
  const root = document.getElementById("rocket-stage-root");
  if (!root || typeof window.mountRocketStage !== "function") return;

  fetch("/partials/rocket-stage.html")
    .then((r) => {
      if (!r.ok) throw new Error("rocket stage fetch failed");
      return r.text();
    })
    .then((html) => {
      root.innerHTML = html;
      window.mountRocketStage(root);
    })
    .catch((e) => {
      console.error(e);
      root.replaceChildren();
      const p = document.createElement("p");
      p.className = "rocket-load-error";
      p.textContent = "Animation konnte nicht geladen werden.";
      root.appendChild(p);
    });
})();
