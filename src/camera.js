// src/camera.js — EcoScan v2 Camera Controller

export let videoEl = null;
export let streamRef = null;
export let canvasEl = null;
export let currentFacingMode = 'environment';

/**
 * Initialises the camera stream and binds it to the provided video element.
 * Stores references for later use by captureFrame() and stopCamera().
 *
 * @param {HTMLVideoElement} videoElement
 * @param {HTMLCanvasElement} canvasElement
 * @returns {Promise<void>}
 * @throws {Error} 'CAMERA_DENIED' | 'CAMERA_ERROR'
 */
export async function initCamera(videoElement, canvasElement) {
  videoEl = videoElement;
  canvasEl = canvasElement;

  const constraints = {
    video: {
      facingMode: currentFacingMode,
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef = stream;
    videoEl.srcObject = stream;
    await videoEl.play();
  } catch (err) {
    if (
      err.name === 'NotAllowedError' ||
      err.name === 'PermissionDeniedError'
    ) {
      throw new Error('CAMERA_DENIED');
    }
    throw new Error('CAMERA_ERROR');
  }
}

/**
 * Captures the current video frame and returns it as a JPEG data URL.
 * Returns null if the video element is not ready.
 *
 * @returns {string|null} Base64 JPEG data URL or null
 */
export function captureFrame() {
  if (
    !videoEl ||
    !canvasEl ||
    videoEl.videoWidth === 0 ||
    videoEl.videoHeight === 0
  ) {
    return null;
  }

  const MAX_DIM = 1024;
  let w = videoEl.videoWidth;
  let h = videoEl.videoHeight;
  
  if (w > MAX_DIM || h > MAX_DIM) {
    if (w > h) {
      h = Math.round((h * MAX_DIM) / w);
      w = MAX_DIM;
    } else {
      w = Math.round((w * MAX_DIM) / h);
      h = MAX_DIM;
    }
  }

  canvasEl.width = w;
  canvasEl.height = h;

  const ctx = canvasEl.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, w, h);

  return canvasEl.toDataURL('image/jpeg', 0.82);
}

/**
 * Stops all active media tracks and clears the video element's source.
 */
export function stopCamera() {
  if (streamRef) {
    streamRef.getTracks().forEach((track) => track.stop());
    streamRef = null;
  }
  if (videoEl) {
    videoEl.srcObject = null;
  }
}

/**
 * Toggles the camera between environment (back) and user (front).
 * @returns {Promise<void>}
 */
export async function toggleCamera() {
  currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
  stopCamera();
  await initCamera(videoEl, canvasEl);
}

/**
 * Returns true if the camera stream is currently active.
 *
 * @returns {boolean}
 */
export function isCameraActive() {
  return (
    streamRef !== null &&
    streamRef.getTracks().some((t) => t.readyState === 'live')
  );
}
