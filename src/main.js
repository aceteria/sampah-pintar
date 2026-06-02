import './style.css';
import { t, setLang, toggleLang, getCurrentLang, translations } from './i18n.js';
import { initCamera, captureFrame, stopCamera, isCameraActive } from './camera.js';
import { classify } from './classifier.js';
import { initUI, switchScreen, showLoading, hideLoading, showError, hideError,
         startFunFacts, stopFunFacts, renderResult, updateLangButtons, getEls } from './ui.js';

let els;

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
