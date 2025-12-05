// --- Remasquage au chargement ---

console.log("contentScript chargé !");

(function applySavedRules() {
  const hostname = location.hostname;

  chrome.storage.sync.get([hostname], data => {
    const selectors = data[hostname] || [];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.display = "none";
      });
    });
  });
})();

// --- Mode sélection ---
let selecting = false;

chrome.runtime.onMessage.addListener(msg => {
  if (msg.action === "enable-select") {
    selecting = true;
    document.body.addEventListener("mouseover", highlight);
    document.body.addEventListener("mouseout", removeHighlight);
    document.body.addEventListener("click", selectElement, true);
  }
});

function highlight(e) {
  if (!selecting) return;
  e.target.classList.add("custom-adblock-hover");
}

function removeHighlight(e) {
  e.target.classList.remove("custom-adblock-hover");
}

// Trouver un sélecteur CSS "fiable"
function getUniqueSelector(el) {
  if (el.id) return `#${el.id}`;
  if (el.className) {
    const classSelector = "." + el.className.trim().replace(/\s+/g, ".");
    return `${el.tagName.toLowerCase()}${classSelector}`;
  }
  return el.tagName.toLowerCase();
}

function selectElement(e) {
  if (!selecting) return;

  e.preventDefault();
  e.stopPropagation();

  const el = e.target;
  const selector = getUniqueSelector(el);
  const hostname = location.hostname;

  // Masquer immédiatement
  el.style.display = "none";

  // Enregistrer
  chrome.storage.sync.get([hostname], data => {
    const selectors = data[hostname] || [];
    if (!selectors.includes(selector)) {
      selectors.push(selector);
    }
    chrome.storage.sync.set({ [hostname]: selectors });
  });

  // Désactiver le mode
  selecting = false;
  document.body.removeEventListener("mouseover", highlight);
  document.body.removeEventListener("mouseout", removeHighlight);
  document.body.removeEventListener("click", selectElement, true);
}
