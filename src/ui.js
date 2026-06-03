// src/ui.js

let els = {};

export function initUI() {
  els.splash = document.getElementById('splash');
  els.cameraView = document.getElementById('camera-view');
  els.resultView = document.getElementById('result-view');
  
  els.btnStart = document.getElementById('btn-start');
  els.btnLang = document.querySelectorAll('.lang-toggle');
  els.btnScan = document.getElementById('btn-scan');
  els.btnSwitchCamera = document.getElementById('btn-switch-camera');
  els.btnScanAgain = document.getElementById('btn-scan-again');
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
  els.reasoningSummary = document.getElementById('reasoning-summary');
  els.decomposeTime = document.getElementById('decompose-time');
  els.gamificationStats = document.getElementById('gamification-stats');
  els.gamificationDesc = document.getElementById('gamification-desc');
  els.confidenceFill = document.getElementById('confidence-fill');
  els.errorMessage = document.getElementById('error-message');
  els.statDecompose = document.getElementById('stat-decompose');
  els.statConfidence = document.getElementById('stat-confidence');
  els.cardGamification = document.getElementById('card-gamification');

  els.btnFeedbackYes = document.getElementById('btn-feedback-yes');
  els.btnFeedbackNo = document.getElementById('btn-feedback-no');
  els.feedbackActions = document.getElementById('feedback-actions');
  els.feedbackTitle = document.getElementById('feedback-title');
  els.feedbackThanks = document.getElementById('feedback-thanks');
  els.feedbackSection = document.getElementById('feedback-section');

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

// SVG icon templates (Phosphor-style, stroke 16)
const SVG_LEAF = '<svg width="18" height="18" viewBox="0 0 256 256"><path d="M216,40H176A104.11,104.11,0,0,0,72,144v24H48a8,8,0,0,0,0,16H72v24a8,8,0,0,0,16,0V184h24A104.11,104.11,0,0,0,216,80Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"></path></svg>';
const SVG_RECYCLE = '<svg width="18" height="18" viewBox="0 0 256 256"><path d="M96,208H72A56,56,0,0,1,72,96l29.71,0" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"></path><polyline points="60 128 92 96 124 128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"></polyline><path d="M160,208h24a56,56,0,0,0,48.49-84" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"></path><polyline points="196 128 164 160 132 128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"></polyline><path d="M128,48a56.06,56.06,0,0,1,48.49,28" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"></path><polyline points="160 96 128 48 96 96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"></polyline></svg>';
const SVG_WARNING = '<svg width="18" height="18" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z" fill="currentColor"></path></svg>';

export function resetFeedbackUI() {
  if (els.feedbackActions) els.feedbackActions.classList.remove('hidden');
  if (els.feedbackTitle) els.feedbackTitle.classList.remove('hidden');
  if (els.feedbackThanks) els.feedbackThanks.classList.add('hidden');
}

export function showFeedbackThanks() {
  if (els.feedbackActions) els.feedbackActions.classList.add('hidden');
  if (els.feedbackTitle) els.feedbackTitle.classList.add('hidden');
  if (els.feedbackThanks) els.feedbackThanks.classList.remove('hidden');
}

export function renderResult(data, imageSrc, lang) {
  resetFeedbackUI();
  if (els.resultThumbnail) els.resultThumbnail.src = imageSrc;
  
  // Colors and Icons based on Kategori
  let iconSvg = SVG_LEAF;
  let color = 'var(--cat-organik)';
  let catText = data.kategori || 'ORGANIK';
  
  if (els.resultView) els.resultView.classList.remove('theme-organik', 'theme-anorganik', 'theme-b3');

  if (data.kategori === 'ORGANIK' || data.kategori === 'ORGANIC') {
    iconSvg = SVG_LEAF;
    color = 'var(--cat-organik)';
    if (els.resultView) els.resultView.classList.add('theme-organik');
  } else if (data.kategori === 'ANORGANIK' || data.kategori === 'INORGANIC') {
    iconSvg = SVG_RECYCLE;
    color = 'var(--cat-anorganik)';
    if (els.resultView) els.resultView.classList.add('theme-anorganik');
  } else if (data.kategori === 'B3' || data.kategori === 'HAZARDOUS') {
    iconSvg = SVG_WARNING;
    color = 'var(--cat-b3)';
    if (els.resultView) els.resultView.classList.add('theme-b3');
  }

  if (els.categoryIcon) els.categoryIcon.innerHTML = iconSvg;
  if (els.categoryName) els.categoryName.textContent = catText;
  if (els.categoryBadge) {
    els.categoryBadge.style.color = color;
    els.categoryBadge.style.backgroundColor = `color-mix(in srgb, ${color} 15%, transparent)`;
  }
  
  if (els.itemName) els.itemName.textContent = data.nama_benda || '';
  if (els.reasoningSummary) {
    els.reasoningSummary.textContent = data.reasoning_summary || '';
    els.reasoningSummary.style.display = data.reasoning_summary ? 'block' : 'none';
  }
  if (els.decomposeTime) els.decomposeTime.textContent = data.waktu_terurai || '';
  
  // Set --card-accent on all themed elements
  const accentEls = [els.statDecompose, els.statConfidence, els.cardGamification];
  accentEls.forEach(el => {
    if (el) el.style.setProperty('--card-accent', color);
  });
  
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
    els.confidenceFill.style.width = '0%';
    requestAnimationFrame(() => {
      els.confidenceFill.style.width = width;
    });
  }
  
  // Re-trigger stagger animations
  const staggerItems = document.querySelectorAll('#result-view .stagger-item');
  staggerItems.forEach(el => {
    el.style.animation = 'none';
    el.offsetHeight; // force reflow
    el.style.animation = '';
  });
}

export function updateLangButtons(lang) {
  if (els.btnLang) {
    els.btnLang.forEach(btn => {
      btn.textContent = lang.toUpperCase();
    });
  }
}

function formatText(text) {
  if (!text) return '';
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  
  lines.forEach(line => {
    line = line.trim();
    if (!line) return;
    
    if (line.match(/^[-*]\s/) || line.match(/^\d+\.\s/)) {
      if (!inList) {
        html += '<ul style="padding-left: 1.2rem; margin-top: 0.3rem; margin-bottom: 0.3rem;">';
        inList = true;
      }
      let content = line.replace(/^[-*]\s/, '').replace(/^\d+\.\s/, '');
      html += `<li style="margin-bottom: 0.2rem;">${content}</li>`;
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<p style="margin-bottom: 0.3rem;">${line}</p>`;
    }
  });
  
  if (inList) {
    html += '</ul>';
  }
  
  return html;
}

export function getEls() { return els; }
