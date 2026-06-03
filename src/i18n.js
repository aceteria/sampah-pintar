// src/i18n.js — EcoScan v2 Internationalization

export const translations = {
  id: {
    tagline: 'Sampah Pintar',
    tap_to_start: 'MULAI SCAN',
    scan_hint: 'Arahkan ke sampah',
    scan_again: 'Scan Lagi',
    analyzing: 'Menganalisis sampah...',
    retry: 'Coba Lagi',
    cancel: 'Batal',
    upload_photo: 'Upload Foto',
    time_to_decompose: 'Waktu Terurai',
    impact: 'Dampak',
    tips: 'Tips',
    confidence: 'Confidence',
    not_detected: 'Tidak ada sampah terdeteksi. Coba lagi.',
    unclear: 'Foto kurang jelas. Pastikan pencahayaan cukup.',
    error_generic: 'Terjadi kesalahan. Periksa koneksi internet.',
    error_timeout: 'Koneksi lambat. Coba lagi.',
    camera_denied: 'Akses kamera ditolak. Gunakan upload foto.',
    fun_facts: [
      'Indonesia menghasilkan sekitar 175.000 ton sampah setiap harinya.',
      'Hanya 7% sampah di Indonesia yang berhasil didaur ulang setiap tahunnya.',
      'Botol plastik membutuhkan waktu hingga 450 tahun untuk terurai di alam.',
      'Sampah organik dapat diolah menjadi kompos yang bermanfaat bagi tanaman.',
      'Baterai yang dibuang sembarangan bisa mencemari tanah dan air selama ratusan tahun.',
    ],
  },
  en: {
    tagline: 'Sampah Pintar',
    tap_to_start: 'TAP TO START',
    scan_hint: 'Point at waste',
    scan_again: 'Scan Again',
    analyzing: 'Analyzing waste...',
    retry: 'Try Again',
    cancel: 'Cancel',
    upload_photo: 'Upload Photo',
    time_to_decompose: 'Decomposition Time',
    impact: 'Impact',
    tips: 'Tips',
    confidence: 'Confidence',
    not_detected: 'No waste detected. Please try again.',
    unclear: 'Photo unclear. Ensure good lighting.',
    error_generic: 'An error occurred. Check your internet.',
    error_timeout: 'Connection slow. Please retry.',
    camera_denied: 'Camera denied. Use photo upload instead.',
    fun_facts: [
      'Indonesia generates approximately 175,000 tons of waste every single day.',
      'Only 7% of Indonesia\'s waste is successfully recycled each year.',
      'A plastic bottle can take up to 450 years to decompose in nature.',
      'Organic waste can be composted into fertilizer that benefits plants greatly.',
      'Improperly discarded batteries can contaminate soil and water for hundreds of years.',
    ],
  },
};

export let currentLang = localStorage.getItem('ecoscan_lang') || 'id';

/**
 * Returns the translation for a given key in the current language.
 * Falls back to the key itself if not found.
 */
export function t(key) {
  return (translations[currentLang] && translations[currentLang][key]) ?? key;
}

/**
 * Sets the active language, persists it to localStorage,
 * and updates all DOM elements that carry a [data-i18n] attribute.
 */
export function setLang(lang) {
  if (!translations[lang]) return;
  currentLang = lang;
  localStorage.setItem('ecoscan_lang', lang);

  // Update every element that has a data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });

  // Also update placeholder attributes where applicable
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', t(key));
  });
}

/**
 * Toggles between 'id' and 'en' languages.
 */
export function toggleLang() {
  setLang(currentLang === 'id' ? 'en' : 'id');
}

/**
 * Returns the currently active language code.
 */
export function getCurrentLang() {
  return currentLang;
}

export default { t, setLang, toggleLang, getCurrentLang, translations };
