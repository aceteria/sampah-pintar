// src/classifier.js — EcoScan v2 Hybrid Classifier (Proxy + Direct Fallback)

const PROXY_TIMEOUT = 8000;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Builds the Gemini classification prompt for the given language.
 *
 * @param {'id'|'en'} lang
 * @returns {string}
 */
function buildPrompt(lang) {
  if (lang === 'en') {
    return `You are an expert waste classification AI. Analyse the image and classify the waste.

CATEGORIES:
- ORGANIC  (color #4A7C59): food scraps, leaves, wood, paper, natural materials
- INORGANIC (color #5B7FA5): plastic, glass, metal, rubber, synthetic materials
- HAZARDOUS (color #C75C5C): batteries, chemicals, electronics, medical waste, paint

INSTRUCTIONS:
1. Identify the primary waste item visible in the image.
2. Classify it into exactly one of the three categories above.
3. Respond ONLY with valid JSON — no markdown, no extra text.

RESPONSE FORMAT (normal detection):
{
  "kategori": "ORGANIC" | "INORGANIC" | "HAZARDOUS",
  "warna": "#4A7C59" | "#5B7FA5" | "#C75C5C",
  "nama_benda": "<item name in English>",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "waktu_terurai": "<decomposition time in English>",
  "dampak": "<environmental impact in English, 1–2 sentences>",
  "tips": "<disposal tip in English, 1–2 sentences>"
}

RESPONSE FORMAT (no waste visible):
{ "kategori": "NOT_DETECTED" }

RESPONSE FORMAT (image too blurry/dark to classify):
{ "kategori": "UNCLEAR" }

Return ONLY valid JSON.`;
  }

  // Default: Indonesian
  return `Kamu adalah AI klasifikasi sampah yang ahli. Analisis gambar dan klasifikasikan sampah.

KATEGORI:
- ORGANIK   (warna #4A7C59): sisa makanan, daun, kayu, kertas, bahan alami
- ANORGANIK (warna #5B7FA5): plastik, kaca, logam, karet, bahan sintetis
- B3         (warna #C75C5C): baterai, bahan kimia, elektronik, limbah medis, cat

INSTRUKSI:
1. Identifikasi benda sampah utama yang terlihat di gambar.
2. Klasifikasikan ke dalam tepat satu kategori di atas.
3. Balas HANYA dengan JSON valid — tanpa markdown, tanpa teks tambahan.

FORMAT RESPONS (deteksi normal):
{
  "kategori": "ORGANIK" | "ANORGANIK" | "B3",
  "warna": "#4A7C59" | "#5B7FA5" | "#C75C5C",
  "nama_benda": "<nama benda dalam Bahasa Indonesia>",
  "confidence": "TINGGI" | "SEDANG" | "RENDAH",
  "waktu_terurai": "<perkiraan waktu terurai>",
  "dampak": "<dampak lingkungan, 1–2 kalimat>",
  "tips": "<tips pembuangan, 1–2 kalimat>"
}

FORMAT RESPONS (tidak ada sampah terlihat):
{ "kategori": "TIDAK_TERDETEKSI" }

FORMAT RESPONS (gambar terlalu buram/gelap):
{ "kategori": "TIDAK_JELAS" }

Kembalikan HANYA JSON valid.`;
}

// ---------------------------------------------------------------------------
// Fetch with timeout
// ---------------------------------------------------------------------------

/**
 * Fetches a URL with an AbortController-based timeout.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Strip data URL prefix helper
// ---------------------------------------------------------------------------

/**
 * Removes the `data:<mime>;base64,` prefix from a data URL.
 *
 * @param {string} dataUrl
 * @returns {{ base64: string, mimeType: string }}
 */
function parseDataUrl(dataUrl) {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    return { base64: dataUrl, mimeType: 'image/jpeg' };
  }
  // e.g. "data:image/jpeg;base64"
  const meta = dataUrl.substring(5, commaIdx); // strip "data:"
  const mimeType = meta.split(';')[0] || 'image/jpeg';
  const base64 = dataUrl.substring(commaIdx + 1);
  return { base64, mimeType };
}

// ---------------------------------------------------------------------------
// Parse Gemini API response text → JSON
// ---------------------------------------------------------------------------

/**
 * Extracts and parses the JSON result from a Gemini API response body.
 *
 * @param {object} body  Parsed response JSON
 * @returns {object}
 */
function extractResult(body) {
  const text =
    body?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Gemini with response_mime_type=application/json should return clean JSON,
  // but strip any accidental markdown fences just in case.
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// ---------------------------------------------------------------------------
// Proxy call
// ---------------------------------------------------------------------------

/**
 * Sends the image to the Vercel proxy endpoint for classification.
 *
 * @param {string} base64Image  Raw base64 (no data URL prefix)
 * @param {'id'|'en'} lang
 * @returns {Promise<object>}
 */
async function callProxy(base64Image, lang) {
  const response = await fetchWithTimeout(
    '/api/classify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image, lang }),
    },
    PROXY_TIMEOUT,
  );

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody?.error || `Proxy error ${response.status}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Main export: classify
// ---------------------------------------------------------------------------

/**
 * Classifies a waste image using the Vercel proxy.
 * Caches the last successful result in sessionStorage.
 *
 * @param {string} base64Image  Full data URL OR raw base64
 * @param {'id'|'en'} lang
 * @returns {Promise<{
 *   kategori: string,
 *   warna: string,
 *   nama_benda: string,
 *   confidence: string,
 *   waktu_terurai: string,
 *   dampak: string,
 *   tips: string
 * }>}
 * @throws {Error} 'TIMEOUT' | API error message
 */
export async function classify(base64Image, lang) {
  // Strip data URL prefix
  const { base64 } = parseDataUrl(base64Image);

  let result;

  try {
    result = await callProxy(base64, lang);
  } catch (proxyErr) {
    // Propagate explicit timeout immediately
    if (proxyErr.message === 'TIMEOUT') throw proxyErr;
    throw proxyErr;
  }

  // Cache in sessionStorage
  try {
    sessionStorage.setItem('ecoscan_last_result', JSON.stringify(result));
  } catch (_) {
    // Storage quota exceeded or unavailable — not critical
  }

  return result;
}
