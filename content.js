// État de l'extension
let isSelectionMode = false;
let hoveredElement = null;

// Obtenir un sélecteur CSS unique pour un élément
function getUniqueSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  
  // Construire un sélecteur basé sur la hiérarchie
  const path = [];
  let current = element;
  
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    
    if (current.className) {
      const classes = Array.from(current.classList)
        .filter(c => c && !c.startsWith('blocker-'))
        .join('.');
      if (classes) {
        selector += `.${classes}`;
      }
    }
    
    // Ajouter nth-child si nécessaire pour être plus spécifique
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        child => child.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
    
    path.unshift(selector);
    current = current.parentElement;
  }
  
  return path.join(' > ');
}

// Obtenir le domaine actuel
function getCurrentDomain() {
  return window.location.hostname;
}

// Charger et appliquer les éléments bloqués
function applyBlockedElements() {
  chrome.storage.local.get(['blockedElements'], (result) => {
    const blockedElements = result.blockedElements || {};
    const domain = getCurrentDomain();
    const selectors = blockedElements[domain] || [];
    
    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          el.style.display = 'none';
          el.setAttribute('data-blocked', 'true');
        });
      } catch (e) {
        console.warn('Sélecteur invalide:', selector, e);
      }
    });
  });
}

// Sauvegarder un élément bloqué
function saveBlockedElement(selector) {
  const domain = getCurrentDomain();
  
  chrome.storage.local.get(['blockedElements'], (result) => {
    const blockedElements = result.blockedElements || {};
    
    if (!blockedElements[domain]) {
      blockedElements[domain] = [];
    }
    
    // Éviter les doublons
    if (!blockedElements[domain].includes(selector)) {
      blockedElements[domain].push(selector);
      chrome.storage.local.set({ blockedElements });
    }
  });
}

// Gérer le survol des éléments
function handleMouseOver(e) {
  if (!isSelectionMode) return;
  
  // Ne pas traiter les notifications
  if (e.target.classList.contains('blocker-notification')) {
    return;
  }
  
  // Retirer le highlight précédent
  if (hoveredElement && hoveredElement !== e.target) {
    hoveredElement.classList.remove('blocker-highlight');
  }
  
  hoveredElement = e.target;
  hoveredElement.classList.add('blocker-highlight');
}

// Gérer le clic sur les éléments
function handleClick(e) {
  if (!isSelectionMode) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  const element = e.target;
  
  // Ne pas traiter les notifications
  if (element.classList.contains('blocker-notification')) {
    return;
  }
  
  // Ne pas bloquer le body ou html
  if (element === document.body || element === document.documentElement) {
    showNotification('❌ Impossible de bloquer cet élément !');
    return;
  }
  
  // Obtenir le sélecteur
  const selector = getUniqueSelector(element);
  
  // Masquer l'élément immédiatement
  element.style.display = 'none';
  element.setAttribute('data-blocked', 'true');
  
  // Sauvegarder
  saveBlockedElement(selector);
  
  // Notification visuelle
  showNotification('✓ Élément bloqué avec succès !');
  
  // Retirer le highlight
  element.classList.remove('blocker-highlight');
  hoveredElement = null;
}

// Afficher une notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'blocker-notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('blocker-notification-show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('blocker-notification-show');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// Toggle mode sélection
function toggleSelectionMode() {
  isSelectionMode = !isSelectionMode;
  
  console.log('Mode sélection:', isSelectionMode);
  
  if (isSelectionMode) {
    document.body.classList.add('blocker-selection-mode');
    document.body.style.cursor = 'crosshair';
    
    // Utiliser capture phase pour intercepter tous les événements
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('click', handleClick, true);
    
    showNotification('🎯 Mode sélection activé - Cliquez sur les éléments à masquer');
  } else {
    document.body.classList.remove('blocker-selection-mode');
    document.body.style.cursor = '';
    
    document.removeEventListener('mouseover', handleMouseOver, true);
    document.removeEventListener('click', handleClick, true);
    
    // Retirer le highlight
    if (hoveredElement) {
      hoveredElement.classList.remove('blocker-highlight');
      hoveredElement = null;
    }
    
    showNotification('⏹️ Mode sélection désactivé');
  }
  
  return isSelectionMode;
}

// Écouter les messages du popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleSelectionMode') {
    const isActive = toggleSelectionMode();
    sendResponse({ isActive });
  } else if (request.action === 'getSelectionMode') {
    sendResponse({ isActive: isSelectionMode });
  } else if (request.action === 'reloadBlocked') {
    // Réafficher tous les éléments puis réappliquer les bloqués
    document.querySelectorAll('[data-blocked]').forEach(el => {
      el.style.display = '';
      el.removeAttribute('data-blocked');
    });
    applyBlockedElements();
    sendResponse({ success: true });
  }
  
  return true;
});

// Appliquer les éléments bloqués au chargement
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyBlockedElements);
} else {
  applyBlockedElements();
}

// Observer les changements du DOM pour les sites dynamiques
const observer = new MutationObserver(() => {
  if (!isSelectionMode) {
    applyBlockedElements();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log('🚫 Bloqueur Personnalisé chargé et prêt');