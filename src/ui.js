// src/ui.js

let els = {};

export function initUI() {
  els.splash = document.getElementById('splash');
  els.cameraView = document.getElementById('camera-view');
  els.resultView = document.getElementById('result-view');
  
  els.btnStart = document.getElementById('btn-start');
  els.btnScan = document.getElementById('btn-scan');
  els.btnScanAgain = document.getElementById('btn-scan-again');
  els.btnLang = document.querySelectorAll('.lang-toggle'); // Both instances
  els.btnRetry = document.getElementById('btn-retry');
  els.btnErrorCancel = document.getElementById('btn-error-cancel');
  
  els.videoFeed = document.getElementById('video-feed');
  els.captureCanvas = document.getElementById('capture-canvas');
  els.fileUpload = document.getElementById('file-upload');
  
  els.loadingOverlay = document.getElementById('loading-overlay');
  els.errorOverlay = document.getElementById('error-overlay');
  els.loadingPreview = document.getElementById('loading-preview-img');
  els.funFact = document.getElementById('fun-fact');
  
  els.resultThumbnail = document.getElementById('result-thumbnail');
  els.categoryBadge = document.getElementById('category-badge');
  els.categoryIcon = document.getElementById('category-icon');
  els.categoryName = document.getElementById('category-name');
  els.itemName = document.getElementById('item-name');
  els.decomposeTime = document.getElementById('decompose-time');
  els.impactDesc = document.getElementById('impact-desc');
  els.tipsDesc = document.getElementById('tips-desc');
  els.confidenceFill = document.getElementById('confidence-fill');
  els.errorMessage = document.getElementById('error-message');
  els.resultCard = document.getElementById('result-card');

  return els;
}

export function switchScreen(name) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  if (name === 'splash' && els.splash) els.splash.classList.add('active');
  if (name === 'camera' && els.cameraView) els.cameraView.classList.add('active');
  if (name === 'result' && els.resultView) els.resultView.classList.add('active');
}

export function showLoading(previewSrc) {
  if (els.loadingPreview && previewSrc) els.loadingPreview.src = previewSrc;
  if (els.loadingOverlay) els.loadingOverlay.classList.remove('hidden');
}

export function hideLoading() {
  if (els.loadingOverlay) els.loadingOverlay.classList.add('hidden');
}

export function showError(message) {
  if (els.errorMessage) els.errorMessage.textContent = message;
  if (els.errorOverlay) els.errorOverlay.classList.remove('hidden');
}

export function hideError() {
  if (els.errorOverlay) els.errorOverlay.classList.add('hidden');
}

let funFactInterval = null;
export function startFunFacts(factsArray) {
  if (!els.funFact || !factsArray || factsArray.length === 0) return;
  
  let index = 0;
  els.funFact.textContent = factsArray[index];
  
  funFactInterval = setInterval(() => {
    els.funFact.style.opacity = 0;
    setTimeout(() => {
      index = (index + 1) % factsArray.length;
      els.funFact.textContent = factsArray[index];
      els.funFact.style.opacity = 1;
    }, 200);
  }, 3500);
}

export function stopFunFacts() {
  if (funFactInterval) {
    clearInterval(funFactInterval);
    funFactInterval = null;
  }
}

export function renderResult(data, imageSrc, lang) {
  if (els.resultThumbnail) els.resultThumbnail.src = imageSrc;
  
  // Colors and Icons based on Kategori
  let icon = '🌿'; // default ORGANIK
  let color = 'var(--cat-organik)';
  let catText = data.kategori || 'ORGANIK';
  
  if (data.kategori === 'ORGANIK' || data.kategori === 'ORGANIC') {
    icon = '🌿';
    color = 'var(--cat-organik)';
  } else if (data.kategori === 'ANORGANIK' || data.kategori === 'INORGANIC') {
    icon = '♻️';
    color = 'var(--cat-anorganik)';
  } else if (data.kategori === 'B3' || data.kategori === 'HAZARDOUS') {
    icon = '⚠️';
    color = 'var(--cat-b3)';
  }

  if (els.categoryIcon) els.categoryIcon.textContent = icon;
  if (els.categoryName) els.categoryName.textContent = catText;
  if (els.categoryBadge) {
    els.categoryBadge.style.color = color;
    els.categoryBadge.style.backgroundColor = `color-mix(in srgb, ${color} 15%, transparent)`;
  }
  
  if (els.itemName) els.itemName.textContent = data.nama_benda || '';
  if (els.decomposeTime) els.decomposeTime.textContent = data.waktu_terurai || '';
  if (els.impactDesc) els.impactDesc.textContent = data.dampak || '';
  if (els.tipsDesc) els.tipsDesc.textContent = data.tips || '';
  
  if (els.confidenceFill) {
    let width = '25%'; // RENDAH/LOW
    if (data.confidence === 'TINGGI' || data.confidence === 'HIGH') {
      width = '90%';
      els.confidenceFill.style.backgroundColor = 'var(--cat-organik)';
    } else if (data.confidence === 'SEDANG' || data.confidence === 'MEDIUM') {
      width = '55%';
      els.confidenceFill.style.backgroundColor = '#F5A623';
    } else {
      els.confidenceFill.style.backgroundColor = 'var(--cat-b3)';
    }
    // Need a tiny delay for CSS transition to trigger if it was just reset to 0
    els.confidenceFill.style.width = '0%';
    requestAnimationFrame(() => {
      els.confidenceFill.style.width = width;
    });
  }
  
  if (els.resultCard) {
    els.resultCard.style.setProperty('--card-accent', color);
  }
}

export function updateLangButtons(lang) {
  if (els.btnLang) {
    els.btnLang.forEach(btn => {
      btn.textContent = lang.toUpperCase();
    });
  }
}

export function getEls() { return els; }
