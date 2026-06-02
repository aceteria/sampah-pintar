// src/classifier.js — EcoScan v2 Hybrid Classifier (Proxy + Direct Fallback)

const PROXY_TIMEOUT = 15000;

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
