import { DECOMPOSITION_TIMES_ID, DECOMPOSITION_TIMES_EN } from './constants.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // ── Preflight ─────────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  // ── Method guard ──────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  // ── API key guard ─────────────────────────────────────────────────────────
  const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
  if (!NVIDIA_API_KEY) {
    console.error('[classify] NVIDIA_API_KEY is not set');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  // ── Parse & validate body ─────────────────────────────────────────────────
  let body;
  try {
    body = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const { image, lang = 'ID' } = body ?? {};

  if (!image) {
    return new Response(JSON.stringify({ error: 'Missing required field: image' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // ── Strip data URL prefix (e.g. "data:image/jpeg;base64,") ───────────────
  const base64Data = image.replace(/^data:[^;]+;base64,/, '');

  // ── Language-aware config ─────────────────────────────────────────────────
  const isEnglish = String(lang).toUpperCase() === 'EN';

  // ── Build system prompt ───────────────────────────────────────────────────
  const prompt = isEnglish
    ? buildPromptEN()
    : buildPromptID();

  // ── Call NVIDIA NIM API ───────────────────────────────────────────────────
  const nimUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';

  const requestBody = {
    model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64Data}`
            }
          }
        ]
      }
    ],
    temperature: 0.1,
    top_p: 0.95,
    max_tokens: 4096
  };

  let nimResponse;
  try {
    nimResponse = await fetch(nimUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`
      },
      body: JSON.stringify(requestBody),
    });
  } catch (networkErr) {
    console.error('[classify] Network error calling NVIDIA NIM:', networkErr);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  if (!nimResponse.ok) {
    const errorText = await nimResponse.text().catch(() => '');
    console.error(
      `[classify] NVIDIA NIM returned ${nimResponse.status}: ${errorText}`
    );
    return new Response(JSON.stringify({ error: 'AI service error' }), { status: nimResponse.status, headers: { 'Content-Type': 'application/json' } });
  }

  // ── Parse NVIDIA NIM response ─────────────────────────────────────────────
  let nimJson;
  try {
    nimJson = await nimResponse.json();
  } catch {
    console.error('[classify] Failed to parse NVIDIA NIM HTTP response as JSON');
    return new Response(JSON.stringify({ error: 'Invalid AI response' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const rawText = nimJson.choices?.[0]?.message?.content ?? '';

  // ── Derive warna from kategori ────────────────────────────────────────────
  function warnaFromKategori(k) {
    if (k === 'ORGANIK' || k === 'ORGANIC')     return '#4A7C59';
    if (k === 'B3'      || k === 'HAZARDOUS')   return '#C75C5C';
    if (k === 'ANORGANIK' || k === 'INORGANIC') return '#5B7FA5';
    return '#888888';
  }

  let classified;
  try {
    // Try direct JSON.parse first, then fall back to ```json block extraction
    let parsed;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      const match = rawText.match(/```json([\s\S]*?)```/i);
      const jsonString = match
        ? match[1].trim()
        : rawText.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(jsonString);
    }
    classified = parsed;

    const isErrorOrEmpty = ['TIDAK_TERDETEKSI', 'TIDAK_JELAS', 'NOT_DETECTED', 'UNCLEAR'].includes(classified.kategori);

    // Always set warna from kategori (AI no longer returns it)
    classified.warna = warnaFromKategori(classified.kategori);

    if (!isErrorOrEmpty) {
      classified.nama_benda = classified.nama_benda || 'Unknown Object';
      classified.confidence = typeof classified.confidence === 'number' ? classified.confidence : 0;
      classified.deskripsi = classified.deskripsi || '';

      if (!classified.waktu_terurai) {
        let matId = (classified.material_id || 'UNKNOWN').toUpperCase().trim();
        const lookupTable = isEnglish ? DECOMPOSITION_TIMES_EN : DECOMPOSITION_TIMES_ID;
        if (!lookupTable[matId]) matId = 'UNKNOWN';
        classified.waktu_terurai = lookupTable[matId];
        classified.material_id = matId;
      }
    } else {
      classified.waktu_terurai = '';
      classified.confidence = typeof classified.confidence === 'number' ? classified.confidence : 0;
    }
  } catch {
    console.error('[classify] Failed to parse JSON output:', rawText);
    const lookupTable = isEnglish ? DECOMPOSITION_TIMES_EN : DECOMPOSITION_TIMES_ID;
    const errorResponse = {
      kategori: isEnglish ? 'UNCLEAR' : 'TIDAK_JELAS',
      warna: '#888888',
      nama_benda: isEnglish ? 'Parse Error' : 'Gagal Membaca',
      material_id: 'UNKNOWN',
      confidence: 0,
      deskripsi: isEnglish
        ? 'The AI returned an invalid format. Try again with better lighting.'
        : 'AI mengembalikan format tidak valid. Coba lagi dengan pencahayaan lebih baik.',
      tips: isEnglish ? 'Please try again.' : 'Silakan coba lagi.',
      waktu_terurai: lookupTable.UNKNOWN,
    };
    return new Response(JSON.stringify(errorResponse), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  // ── Return result ─────────────────────────────────────────────────────────
  return new Response(JSON.stringify(classified), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────────────────────

function buildPromptID() {
  return `Kamu adalah AI klasifikasi sampah. Analisis gambar dan kembalikan HANYA JSON valid, tanpa teks lain.

Skema JSON:
{"kategori":"ORGANIK|ANORGANIK|B3|TIDAK_TERDETEKSI|TIDAK_JELAS","nama_benda":"string","material_id":"string","deskripsi":"string - 1 kalimat kenapa benda ini masuk kategori tersebut","confidence":0-100,"tips":"string - 1 kalimat cara buang yang benar","waktu_terurai":"string - spesifik estimasi waktu benda ini terurai (misal: '2 minggu', '400 tahun')"}

MATERIAL_ID (pilih tepat satu):
PLASTIC_BOTTLE, PLASTIC_BAG, PAPER, CARDBOARD, GLASS, ALUMINUM, TIN_STEEL, ORGANIC_FOOD, ORGANIC_YARD, STYROFOAM, E_WASTE, TEXTILE, BATTERY, RUBBER, WOOD, CERAMIC, COMPOSITE, UNKNOWN

Kategori:
- ORGANIK: bahan dari makhluk hidup (ORGANIC_FOOD, ORGANIC_YARD)
- ANORGANIK: sulit terurai tapi aman (PLASTIC_BOTTLE, PAPER, GLASS, ALUMINUM, STYROFOAM, COMPOSITE untuk Tetra Pak)
- B3: berbahaya/beracun (BATTERY, E_WASTE, bahan kimia)

ATURAN WAJIB: SEMUA elektronik (kipas, kabel, charger, HP, PCB) = B3 + E_WASTE. Elektronik BUKAN ANORGANIK.

Kasus tepi:
- Gambar kosong/hitam: {"kategori":"TIDAK_TERDETEKSI","nama_benda":"","material_id":"UNKNOWN","deskripsi":"","confidence":0,"tips":"","waktu_terurai":""}
- Gambar blur/tidak jelas: {"kategori":"TIDAK_JELAS","nama_benda":"Tidak dapat diidentifikasi","material_id":"UNKNOWN","deskripsi":"Gambar tidak cukup jelas untuk diidentifikasi.","confidence":0,"tips":"Coba foto lebih dekat dengan pencahayaan baik.","waktu_terurai":""}
- Beberapa benda: klasifikasi yang paling dominan
- Campuran tak terpisah: gunakan kategori paling berbahaya (B3>ANORGANIK>ORGANIK), material_id=COMPOSITE

confidence adalah angka 0-100. Kembalikan HANYA JSON, tanpa penjelasan.`;
}

function buildPromptEN() {
  return `You are a waste classification AI. Analyze the image and return ONLY valid JSON, no other text.

JSON schema:
{"kategori":"ORGANIC|INORGANIC|HAZARDOUS|NOT_DETECTED|UNCLEAR","nama_benda":"string","material_id":"string","deskripsi":"string - 1 sentence explaining why this item belongs in this category","confidence":0-100,"tips":"string - 1 actionable disposal sentence","waktu_terurai":"string - specific estimated decomposition time for this object (e.g. '2 weeks', '400 years')"}

MATERIAL_ID (pick exactly one):
PLASTIC_BOTTLE, PLASTIC_BAG, PAPER, CARDBOARD, GLASS, ALUMINUM, TIN_STEEL, ORGANIC_FOOD, ORGANIC_YARD, STYROFOAM, E_WASTE, TEXTILE, BATTERY, RUBBER, WOOD, CERAMIC, COMPOSITE, UNKNOWN

Categories:
- ORGANIC: from living organisms (ORGANIC_FOOD, ORGANIC_YARD)
- INORGANIC: non-biodegradable but safe (PLASTIC_BOTTLE, PAPER, GLASS, ALUMINUM, STYROFOAM, COMPOSITE for Tetra Pak)
- HAZARDOUS: toxic/dangerous (BATTERY, E_WASTE, chemicals)

MANDATORY RULE: ALL electronics (fans, cables, chargers, phones, PCBs) = HAZARDOUS + E_WASTE. Electronics are NEVER INORGANIC.

Edge cases:
- Empty/black image: {"kategori":"NOT_DETECTED","nama_benda":"","material_id":"UNKNOWN","deskripsi":"","confidence":0,"tips":"","waktu_terurai":""}
- Blurry/unrecognizable: {"kategori":"UNCLEAR","nama_benda":"Cannot be identified","material_id":"UNKNOWN","deskripsi":"Image is not clear enough to identify.","confidence":0,"tips":"Try a closer photo with better lighting.","waktu_terurai":""}
- Multiple objects: classify the most dominant one
- Inseparable mix: use most hazardous category (HAZARDOUS>INORGANIC>ORGANIC), material_id=COMPOSITE

confidence is a number 0-100. Return ONLY JSON, no explanation.`;
}
