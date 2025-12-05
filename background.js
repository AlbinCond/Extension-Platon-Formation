// Installation de l'extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Bloqueur Personnalisé installé avec succès !');
  
  // Initialiser le storage si nécessaire
  chrome.storage.local.get(['blockedElements'], (result) => {
    if (!result.blockedElements) {
      chrome.storage.local.set({ blockedElements: {} });
    }
  });
});

// Écouter les changements d'onglet pour mettre à jour l'icône
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  updateBadge(activeInfo.tabId);
});

// Écouter les mises à jour d'URL
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    updateBadge(tabId);
  }
});

// Mettre à jour le badge avec le nombre d'éléments bloqués
async function updateBadge(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const url = new URL(tab.url);
    const domain = url.hostname;
    
    chrome.storage.local.get(['blockedElements'], (result) => {
      const blockedElements = result.blockedElements || {};
      const count = (blockedElements[domain] || []).length;
      
      if (count > 0) {
        chrome.action.setBadgeText({ 
          text: count.toString(), 
          tabId: tabId 
        });
        chrome.action.setBadgeBackgroundColor({ 
          color: '#ef4444', 
          tabId: tabId 
        });
      } else {
        chrome.action.setBadgeText({ 
          text: '', 
          tabId: tabId 
        });
      }
    });
  } catch (e) {
    // Ignorer les erreurs pour les pages système
  }
}

// Écouter les changements du storage pour mettre à jour les badges
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.blockedElements) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          updateBadge(tab.id);
        }
      });
    });
  }
});