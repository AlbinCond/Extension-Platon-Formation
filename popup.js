// Récupérer l'onglet actuel
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Obtenir le domaine de l'URL
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

// Mettre à jour les statistiques
async function updateStats() {
  const tab = await getCurrentTab();
  const domain = getDomain(tab.url);
  
  if (!domain) return;

  chrome.storage.local.get(['blockedElements'], (result) => {
    const blockedElements = result.blockedElements || {};
    const siteBlocked = blockedElements[domain] || [];
    const totalBlocked = Object.values(blockedElements).reduce((sum, arr) => sum + arr.length, 0);

    document.getElementById('site-count').textContent = siteBlocked.length;
    document.getElementById('total-count').textContent = totalBlocked;
  });
}

// Vérifier l'état du mode sélection
async function checkSelectionMode() {
  const tab = await getCurrentTab();
  
  chrome.tabs.sendMessage(tab.id, { action: 'getSelectionMode' }, (response) => {
    if (chrome.runtime.lastError) {
      updateButtonState(false);
      return;
    }
    
    updateButtonState(response?.isActive || false);
  });
}

// Mettre à jour l'interface du bouton
function updateButtonState(isActive) {
  const toggleBtn = document.getElementById('toggleBtn');
  const btnIcon = document.getElementById('btn-icon');
  const btnText = document.getElementById('btn-text');
  const status = document.getElementById('status');
  const modeText = document.getElementById('mode-text');

  if (isActive) {
    btnIcon.textContent = '⏹️';
    btnText.textContent = 'Désactiver le mode sélection';
    toggleBtn.classList.remove('btn-primary');
    toggleBtn.classList.add('btn-secondary');
    status.classList.add('status-active');
    modeText.textContent = 'Actif - Cliquez sur les éléments';
  } else {
    btnIcon.textContent = '🎯';
    btnText.textContent = 'Activer le mode sélection';
    toggleBtn.classList.remove('btn-secondary');
    toggleBtn.classList.add('btn-primary');
    status.classList.remove('status-active');
    modeText.textContent = 'Inactif';
  }
}

// Toggle mode sélection
document.getElementById('toggleBtn').addEventListener('click', async () => {
  const tab = await getCurrentTab();
  
  // Injecter le content script si nécessaire
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  } catch (e) {
    // Le script est peut-être déjà injecté
  }
  
  // Attendre un peu avant d'envoyer le message
  setTimeout(() => {
    chrome.tabs.sendMessage(tab.id, { action: 'toggleSelectionMode' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Erreur:', chrome.runtime.lastError);
        alert('Impossible d\'activer le mode sélection. Rechargez la page et réessayez.');
        return;
      }
      if (response) {
        updateButtonState(response.isActive);
      }
    });
  }, 100);
});

// Voir les éléments bloqués
document.getElementById('viewBlockedBtn').addEventListener('click', async () => {
  const tab = await getCurrentTab();
  const domain = getDomain(tab.url);
  
  chrome.storage.local.get(['blockedElements'], (result) => {
    const blockedElements = result.blockedElements || {};
    const siteBlocked = blockedElements[domain] || [];
    
    if (siteBlocked.length === 0) {
      alert('Aucun élément bloqué sur ce site.');
      return;
    }
    
    const message = `Éléments bloqués sur ${domain}:\n\n` + 
      siteBlocked.map((sel, i) => `${i + 1}. ${sel}`).join('\n');
    alert(message);
  });
});

//Voir les sites bloqués
document.getElementById('viewBlockedSitesBtn').addEventListener('click', () => {
  chrome.storage.local.get(['blockedElements'], (result) => {
    const blockedElements = result.blockedElements || {};
    const domains = Object.keys(blockedElements);   
    if (domains.length === 0) {
      alert('Aucun site avec des éléments bloqués.');
      return;
    }
    
    const message = `Sites avec des éléments bloqués:\n\n` + 
      domains.map((domain, i) => `${i + 1}. ${domain}`).join('\n');
    alert(message);
    });
});

// Effacer ce site
document.getElementById('clearSiteBtn').addEventListener('click', async () => {
  const tab = await getCurrentTab();
  const domain = getDomain(tab.url);
  
  if (!confirm(`Voulez-vous vraiment supprimer tous les éléments bloqués sur ${domain} ?`)) {
    return;
  }
  
  chrome.storage.local.get(['blockedElements'], (result) => {
    const blockedElements = result.blockedElements || {};
    delete blockedElements[domain];
    
    chrome.storage.local.set({ blockedElements }, () => {
      chrome.tabs.sendMessage(tab.id, { action: 'reloadBlocked' });
      updateStats();
      alert('Éléments supprimés ! Rechargez la page pour voir les changements.');
    });
  });
});

// Tout effacer
document.getElementById('clearAllBtn').addEventListener('click', () => {
  if (!confirm('Voulez-vous vraiment supprimer TOUS les éléments bloqués sur TOUS les sites ?')) {
    return;
  }
  
  chrome.storage.local.set({ blockedElements: {} }, async () => {
    const tab = await getCurrentTab();
    chrome.tabs.sendMessage(tab.id, { action: 'reloadBlocked' });
    updateStats();
    alert('Tous les éléments ont été supprimés ! Rechargez les pages pour voir les changements.');
  });
});

// Initialisation
checkSelectionMode();
updateStats();

// Écouter les changements du storage
chrome.storage.onChanged.addListener(() => {
  updateStats();
});