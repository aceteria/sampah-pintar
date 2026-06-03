import './style.css';
import { t, setLang, toggleLang, getCurrentLang, translations } from './i18n.js';
import { initCamera, captureFrame, stopCamera, isCameraActive } from './camera.js';
import { classify } from './classifier.js';
import { initUI, switchScreen, showLoading, hideLoading, showError, hideError,
         startFunFacts, stopFunFacts, renderResult, updateLangButtons, getEls, showFeedbackThanks } from './ui.js';

let els;
let lastResult = null;
let lastImage = null;

document.addEventListener('DOMContentLoaded', () => {
  els = initUI();
  
  const currentLang = getCurrentLang();
  setLang(currentLang);
  updateLangButtons(currentLang);
  
  switchScreen('splash');

  // Wire event listeners
  if (els.btnStart) {
    els.btnStart.addEventListener('click', async () => {
      switchScreen('camera');
      await startCamera();
    });
  }

  if (els.btnScan) {
    els.btnScan.addEventListener('click', handleScan);
  }

  if (els.btnScanAgain) {
    els.btnScanAgain.addEventListener('click', async () => {
      switchScreen('camera');
      await startCamera();
    });
  }

  if (els.btnLang) {
    els.btnLang.forEach(btn => {
      btn.addEventListener('click', () => {
        toggleLang();
        updateLangButtons(getCurrentLang());
      });
    });
  }

  if (els.btnRetry) {
    els.btnRetry.addEventListener('click', async () => {
      hideError();
      if (els.cameraView.classList.contains('active')) {
        await handleScan();
      }
    });
  }

  if (els.btnErrorCancel) {
    els.btnErrorCancel.addEventListener('click', () => {
      hideError();
    });
  }

  if (els.fileUpload) {
    els.fileUpload.addEventListener('change', handleFileUpload);
  }

  // Initialize Gamification State
  initGamificationState();

  // Feedback Event Listeners
  if (els.btnFeedbackYes) {
    els.btnFeedbackYes.addEventListener('click', () => handleFeedback(true));
  }
  if (els.btnFeedbackNo) {
    els.btnFeedbackNo.addEventListener('click', () => handleFeedback(false));
  }
});

async function handleFeedback(isCorrect) {
  showFeedbackThanks();
  if (!lastResult || !lastImage) return;

  try {
    const payload = {
      image: lastImage,
      kategori: lastResult.kategori,
      material_id: lastResult.material_id || 'UNKNOWN',
      is_correct: isCorrect
    };

    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(e => console.error('Feedback error:', e));
  } catch (e) {
    console.error('Feedback error:', e);
  }
}

async function startCamera() {
  try {
    await initCamera(els.videoFeed, els.captureCanvas);
  } catch (err) {
    if (err.message === 'CAMERA_DENIED') {
      showError(t('camera_denied'));
    } else {
      showError(t('error_generic'));
    }
  }
}

async function handleScan() {
  const frame = captureFrame();
  if (!frame) return;
  await runClassification(frame);
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    await runClassification(e.target.result);
  };
  reader.readAsDataURL(file);
}

async function runClassification(imageData, retryCount = 0) {
  showLoading(imageData);
  if (retryCount === 0) {
    startFunFacts(translations[getCurrentLang()].fun_facts);
  } else {
    // Show progress indicator text during retry
    const loadingText = document.querySelector('#loading-overlay h2');
    if (loadingText) {
      loadingText.textContent = getCurrentLang() === 'en' ? 'Retrying analysis...' : 'Mencoba ulang analisis...';
    }
  }
  
  try {
    const result = await classify(imageData, getCurrentLang());
    hideLoading();
    stopFunFacts();
    
    if (result.kategori === 'TIDAK_TERDETEKSI' || result.kategori === 'NOT_DETECTED') {
      showError(t('not_detected'));
      return;
    }
    if (result.kategori === 'TIDAK_JELAS' || result.kategori === 'UNCLEAR') {
      showError(t('unclear'));
      return;
    }
    
    stopCamera();
    lastResult = result;
    lastImage = imageData;
    
    // Gamification step
    handleGamification(result);
    
    renderResult(result, imageData, getCurrentLang());
    switchScreen('result');
  } catch (err) {
    if (retryCount < 1) {
      console.warn('Classification failed, retrying once...', err);
      // Retry once automatically
      return runClassification(imageData, retryCount + 1);
    }
    
    hideLoading();
    stopFunFacts();
    const msg = err.message === 'TIMEOUT' ? t('error_timeout') : t('error_generic');
    showError(msg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gamification Logic
// ─────────────────────────────────────────────────────────────────────────────

function initGamificationState() {
  const today = new Date().toLocaleDateString();
  let state = JSON.parse(localStorage.getItem('ecoscan_gamification') || '{}');
  
  if (state.date !== today) {
    state = {
      date: today,
      user_weight_kg: 0.0,
      user_items_count: 0,
      base_school_score: Math.floor(Math.random() * 500) + 1000 // random base score (1000-1500)
    };
    localStorage.setItem('ecoscan_gamification', JSON.stringify(state));
  }
}

function handleGamification(result) {
  if (!result || !result.kategori) return;
  if (result.kategori === 'TIDAK_TERDETEKSI' || result.kategori === 'TIDAK_JELAS') return;
  if (result.kategori === 'NOT_DETECTED' || result.kategori === 'UNCLEAR') return;

  const state = JSON.parse(localStorage.getItem('ecoscan_gamification') || '{}');
  
  // Assign weight based on category (B3: 0.5kg, Organik: 0.2kg, Anorganik: 0.1kg)
  let weight = 0.1;
  let catLower = result.kategori.toLowerCase();
  
  if (catLower.includes('b3') || catLower.includes('hazardous')) {
    weight = 0.5;
  } else if (catLower.includes('organik') || catLower.includes('organic')) {
    weight = 0.2;
  }
  
  // Format category string
  let displayCategory = 'Anorganik';
  if (catLower.includes('b3') || catLower.includes('hazardous')) displayCategory = 'B3';
  if (catLower.includes('organik') || catLower.includes('organic')) displayCategory = 'Organik';

  state.user_items_count += 1;
  state.user_weight_kg += weight;
  localStorage.setItem('ecoscan_gamification', JSON.stringify(state));

  // School score = base + (user_items_count * 50)
  const currentSchoolScore = state.base_school_score + (state.user_items_count * 50);

  // Update UI
  const gamificationStats = getEls().gamificationStats;
  const gamificationDesc = getEls().gamificationDesc;

  if (gamificationStats && gamificationDesc) {
    const lang = getCurrentLang();
    const itemsLabel = lang === 'en' ? 'Items Disposed Today' : 'Total Item Terbuang Hari Ini';
    gamificationStats.textContent = `${itemsLabel}: ${state.user_items_count}`;
    
    // gamification_msg(weight, category, score)
    gamificationDesc.textContent = t('gamification_msg')(weight.toFixed(1), displayCategory, currentSchoolScore.toLocaleString());
  }
}

