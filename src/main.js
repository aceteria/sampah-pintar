import './style.css';
import { t, setLang, toggleLang, getCurrentLang, translations } from './i18n.js';
import { initCamera, captureFrame, stopCamera, isCameraActive, toggleCamera } from './camera.js';
import { classify } from './classifier.js';
import { initUI, switchScreen, showLoading, hideLoading, showError, hideError,
         startFunFacts, stopFunFacts, renderResult, updateLangButtons, getEls, updateDateDisplay, updateSplashGamification } from './ui.js';

let els;
let lastResult = null;
let lastImage = null;

document.addEventListener('DOMContentLoaded', () => {
  els = initUI();
  
  const currentLang = getCurrentLang();
  setLang(currentLang);
  updateLangButtons(currentLang);
  updateDateDisplay(currentLang);
  updateSplashGamification(getScanCount());
  
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

  if (els.btnSwitchCamera) {
    els.btnSwitchCamera.addEventListener('click', async () => {
      await toggleCamera();
    });
  }

  if (els.btnScanAgain) {
    els.btnScanAgain.addEventListener('click', async () => {
      switchScreen('camera');
      await startCamera();
    });
  }

  if (els.btnHome) {
    els.btnHome.addEventListener('click', () => {
      updateDateDisplay(getCurrentLang());
      updateSplashGamification(getScanCount());
      switchScreen('splash');
    });
  }

  if (els.btnLang) {
    els.btnLang.forEach(btn => {
      btn.addEventListener('click', () => {
        toggleLang();
        const newLang = getCurrentLang();
        updateLangButtons(newLang);
        updateDateDisplay(newLang);
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
});

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
    const loadingText = document.querySelector('#loading-overlay h2');
    if (loadingText) {
      loadingText.textContent = getCurrentLang() === 'en' ? 'Retrying analysis...' : 'Mencoba ulang analisis...';
    }
  }
  
  try {
    const result = await classify(imageData, getCurrentLang());
    hideLoading();
    stopFunFacts();
    
    // Handle not detected / unclear
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
    
    const scanCount = incrementScanCount();
    updateSplashGamification(scanCount);
    renderResult(result, imageData, getCurrentLang(), scanCount);
    switchScreen('result');
  } catch (err) {
    if (retryCount < 1) {
      console.warn('Classification failed, retrying once...', err);
      return runClassification(imageData, retryCount + 1);
    }
    
    hideLoading();
    stopFunFacts();
    const msg = err.message === 'TIMEOUT' ? t('error_timeout') : t('error_generic');
    showError(msg);
  }
}

function incrementScanCount() {
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  let scans = JSON.parse(localStorage.getItem('sapi_scans') || '{"count": 0}');
  if (scans.date !== today) {
    scans = { date: today, count: 1 };
  } else {
    scans.count += 1;
  }
  localStorage.setItem('sapi_scans', JSON.stringify(scans));
  return scans.count;
}

function getScanCount() {
  const today = new Date().toLocaleDateString('en-CA');
  let scans = JSON.parse(localStorage.getItem('sapi_scans') || '{"count": 0}');
  if (scans.date !== today) {
    return 0;
  }
  return scans.count;
}
