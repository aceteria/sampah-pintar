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
    max_tokens: 4096,
    reasoning_budget: 1024,
    chat_template_kwargs: { "enable_thinking": true }
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

  let classified;
  try {
    // Extract JSON from markdown block to avoid reasoning text parsing issues
    const match = rawText.match(/```json([\s\S]*?)```/i);
    const jsonString = match ? match[1].trim() : rawText.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    classified = JSON.parse(jsonString);
    
    // Schema validation and fallbacks
    const isErrorOrEmpty = ['TIDAK_TERDETEKSI', 'TIDAK_JELAS', 'NOT_DETECTED', 'UNCLEAR'].includes(classified.kategori);
    if (!isErrorOrEmpty) {
      classified.warna = classified.warna || (classified.kategori === 'ORGANIK' || classified.kategori === 'ORGANIC' ? '#4A7C59' : classified.kategori === 'B3' || classified.kategori === 'HAZARDOUS' ? '#C75C5C' : '#5B7FA5');
      classified.nama_benda = classified.nama_benda || 'Unknown Object';
      classified.confidence = classified.confidence || 'RENDAH';
      
      let matId = (classified.material_id || 'UNKNOWN').toUpperCase().trim();
      const lookupTable = isEnglish ? DECOMPOSITION_TIMES_EN : DECOMPOSITION_TIMES_ID;
      if (!lookupTable[matId]) matId = 'UNKNOWN';
      classified.waktu_terurai = lookupTable[matId];
      classified.material_id = matId; // normalize it but keep it
      classified.reasoning_summary = classified.reasoning_summary || 'Analyzed via image recognition.';
    } else {
      // Empty or error case mapping
      const lookupTable = isEnglish ? DECOMPOSITION_TIMES_EN : DECOMPOSITION_TIMES_ID;
      classified.waktu_terurai = "";
    }
  } catch {
    console.error('[classify] Failed to parse JSON output:', rawText);
    const lookupTable = isEnglish ? DECOMPOSITION_TIMES_EN : DECOMPOSITION_TIMES_ID;
    // Return a partial failure rather than a 500 crash so UI handles it gracefully
    const errorResponse = {
      kategori: 'TIDAK_JELAS',
      warna: '#888888',
      nama_benda: 'Parse Error',
      confidence: 'RENDAH',
      waktu_terurai: lookupTable.UNKNOWN,
      dampak: 'The AI provided an invalid format.',
      tips: 'Please try again.',
      reasoning_summary: 'We had trouble parsing the response. Please try moving closer or adjusting the lighting.'
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
  return `
Kamu adalah sistem klasifikasi sampah berbasis AI yang sangat akurat.
Langkah 1: Analisis gambar yang diberikan dan tuliskan sedikit penalaran tentang bahan dan objek yang kamu lihat.
Langkah 2: Kembalikan objek JSON yang valid di dalam blok \`\`\`json ... \`\`\` sesuai skema di bawah ini. JANGAN berikan JSON tanpa blok \`\`\`json\`\`\`.

═══════════════════════════════════════════
SKEMA JSON (wajib diikuti persis):
═══════════════════════════════════════════
{
  "kategori"         : string,   // Satu dari: "ORGANIK" | "ANORGANIK" | "B3" | "TIDAK_TERDETEKSI" | "TIDAK_JELAS"
  "warna"            : string,   // Kode hex warna: ORGANIK="#4A7C59", ANORGANIK="#5B7FA5", B3="#C75C5C"
  "nama_benda"       : string,   // Nama benda yang teridentifikasi, dalam Bahasa Indonesia (contoh: "Botol Plastik PET", "Kulit Pisang")
  "material_id"      : string,   // WAJIB salah satu string persis dari DAFTAR MATERIAL_ID di bawah
  "confidence"       : string,   // Tingkat keyakinan: "TINGGI" | "SEDANG" | "RENDAH"
  "dampak"           : string,   // 1 kalimat singkat: dampak lingkungan jika dibuang ke tempat sampah umum
  "tips"             : string,   // 1 kalimat singkat: cara pembuangan yang benar dan dapat langsung dilakukan
  "reasoning_summary": string    // 1 kalimat singkat menjelaskan alasan benda ini dikategorikan demikian untuk meyakinkan pengguna
}

═══════════════════════════════════════════
DAFTAR MATERIAL_ID (Pilih SALAH SATU yang paling tepat):
═══════════════════════════════════════════
- PLASTIC_BOTTLE (Botol plastik PET)
- PLASTIC_BAG (Kantong kresek, kemasan plastik lentur)
- PAPER (Kertas, tisu, koran)
- CARDBOARD (Kardus, karton)
- GLASS (Kaca, botol beling)
- ALUMINUM (Kaleng minuman aluminium)
- TIN_STEEL (Kaleng besi/baja, sarden)
- ORGANIC_FOOD (Sisa makanan, kulit buah, tulang)
- ORGANIC_YARD (Daun, ranting, kayu alami)
- STYROFOAM (Gabus styrofoam)
- E_WASTE (Elektronik bekas, kabel, PCB)
- TEXTILE (Kain, baju bekas, karpet)
- BATTERY (Baterai bekas)
- RUBBER (Karet, ban bekas)
- WOOD (Kayu olahan, furnitur)
- CERAMIC (Keramik, porselen)
- COMPOSITE (Material campuran yang sulit dipisah, misal Tetra Pak atau mainan plastik-besi)
- UNKNOWN (Benda tidak dikenali)

═══════════════════════════════════════════
DEFINISI KATEGORI:
═══════════════════════════════════════════
• ORGANIK (#4A7C59)    — Bahan yang berasal dari makhluk hidup. Contoh: ORGANIC_FOOD, ORGANIC_YARD.
• ANORGANIK (#5B7FA5)  — Bahan yang sulit terurai tapi aman. Contoh: PLASTIC_BOTTLE, PAPER, GLASS, ALUMINUM, STYROFOAM.
                         PENTING: Tetra Pak adalah ANORGANIK (COMPOSITE). JANGAN masukkan elektronik ke sini.
• B3 (#C75C5C)         — Bahan Berbahaya dan Beracun. Contoh: BATTERY, E_WASTE, botol obat/bahan kimia.
                         PENTING MUTLAK: SEMUA BARANG ELEKTRONIK (kipas angin kecil/handheld fan, kabel, charger, HP, dsb) WAJIB diklasifikasikan sebagai B3 dan material_id E_WASTE. JANGAN mengklasifikasikan elektronik sebagai ANORGANIK.

═══════════════════════════════════════════
PENANGANAN KASUS TEPI:
═══════════════════════════════════════════
• Jika gambar TIDAK MENGANDUNG BENDA APAPUN (kosong, layar hitam):
  Kembalikan: { "kategori": "TIDAK_TERDETEKSI", "warna": "#888888", "nama_benda": "", "material_id": "UNKNOWN", "confidence": "RENDAH", "dampak": "", "tips": "", "reasoning_summary": "" }

• Jika gambar terlalu blur atau tidak dapat diidentifikasi:
  Kembalikan: { "kategori": "TIDAK_JELAS", "warna": "#888888", "nama_benda": "Tidak dapat diidentifikasi", "material_id": "UNKNOWN", "confidence": "RENDAH", "dampak": "Tidak dapat ditentukan karena gambar tidak cukup jelas.", "tips": "Coba ambil foto lebih dekat dengan pencahayaan yang baik.", "reasoning_summary": "" }

• Jika ada BEBERAPA BENDA, klasifikasi berdasarkan benda yang PALING DOMINAN.
• Jika benda CAMPURAN (makanan dalam plastik), gunakan kategori yang PALING BERBAHAYA (B3 > ANORGANIK > ORGANIK) dan material_id COMPOSITE.

Pastikan kamu mengeluarkan blok \`\`\`json ... \`\`\` di akhir responsmu.
`.trim();
}

function buildPromptEN() {
  return `
You are a highly accurate AI-powered waste classification system.
Step 1: Analyze the provided image and write a brief reasoning about the materials and objects you see.
Step 2: Return a valid JSON object inside a \`\`\`json ... \`\`\` block following the schema below. DO NOT return the JSON without the \`\`\`json\`\`\` block.

═══════════════════════════════════════════
JSON SCHEMA (must be followed exactly):
═══════════════════════════════════════════
{
  "kategori"         : string,   // One of: "ORGANIC" | "INORGANIC" | "HAZARDOUS" | "TIDAK_TERDETEKSI" | "TIDAK_JELAS"
  "warna"            : string,   // Category color hex: ORGANIC="#4A7C59", INORGANIC="#5B7FA5", HAZARDOUS="#C75C5C"
  "nama_benda"       : string,   // Name of the identified object in English (e.g. "PET Plastic Bottle")
  "material_id"      : string,   // MUST be EXACTLY one of the strings from the MATERIAL_ID LIST below
  "confidence"       : string,   // Confidence level: "HIGH" | "MEDIUM" | "LOW"
  "dampak"           : string,   // 1 concise sentence: environmental impact if discarded in general waste
  "tips"             : string,   // 1 concise actionable tip: correct disposal method
  "reasoning_summary": string    // 1 concise sentence explaining why this item was categorized as such
}

═══════════════════════════════════════════
MATERIAL_ID LIST (Choose EXACTLY ONE that fits best):
═══════════════════════════════════════════
- PLASTIC_BOTTLE (PET plastic bottles)
- PLASTIC_BAG (Plastic bags, flexible packaging)
- PAPER (Paper, tissue, newspaper)
- CARDBOARD (Cardboard boxes)
- GLASS (Glass bottles, jars)
- ALUMINUM (Aluminum cans)
- TIN_STEEL (Steel/tin cans)
- ORGANIC_FOOD (Food scraps, peels, bones)
- ORGANIC_YARD (Leaves, twigs, natural wood)
- STYROFOAM (Styrofoam cups/packaging)
- E_WASTE (Old electronics, cables, PCBs)
- TEXTILE (Clothing, fabrics, carpets)
- BATTERY (Used batteries)
- RUBBER (Rubber, tires)
- WOOD (Treated/processed wood, furniture)
- CERAMIC (Ceramics, porcelain)
- COMPOSITE (Inseparable mixed materials, e.g., Tetra Pak, toys with plastic and metal)
- UNKNOWN (Object unrecognizable)

═══════════════════════════════════════════
CATEGORY DEFINITIONS:
═══════════════════════════════════════════
• ORGANIC (#4A7C59)    — Materials from living organisms. e.g., ORGANIC_FOOD, ORGANIC_YARD.
• INORGANIC (#5B7FA5)  — Materials that don't decompose naturally but are safe. e.g., PLASTIC_BOTTLE, PAPER, GLASS, ALUMINUM, STYROFOAM.
                         IMPORTANT: Tetra Paks are INORGANIC (COMPOSITE). DO NOT put electronics here.
• HAZARDOUS (#C75C5C)  — Toxic waste. e.g., BATTERY, E_WASTE, chemical bottles.
                         ABSOLUTE REQUIREMENT: ALL ELECTRONICS (handheld fans, cables, chargers, phones, etc.) MUST be classified as HAZARDOUS and material_id E_WASTE. DO NOT classify electronics as INORGANIC.

═══════════════════════════════════════════
EDGE CASE HANDLING:
═══════════════════════════════════════════
• If the image CONTAINS NO OBJECT (blank image, black screen):
  Return: { "kategori": "TIDAK_TERDETEKSI", "warna": "#888888", "nama_benda": "", "material_id": "UNKNOWN", "confidence": "LOW", "dampak": "", "tips": "", "reasoning_summary": "" }

• If the image cannot be classified (too blurry, too dark, unrecognizable):
  Return: { "kategori": "TIDAK_JELAS", "warna": "#888888", "nama_benda": "Cannot be identified", "material_id": "UNKNOWN", "confidence": "LOW", "dampak": "Cannot be determined as the image is not clear enough.", "tips": "Try taking a closer photo with better lighting.", "reasoning_summary": "" }

• If there are MULTIPLE OBJECTS, classify based on the MOST DOMINANT item.
• If the item is an INSEPARABLE MIX (e.g., food inside a plastic container), use the MOST HAZARDOUS category (HAZARDOUS > INORGANIC > ORGANIC) and use material_id COMPOSITE.

Make sure to output the \`\`\`json ... \`\`\` block at the end of your response.
`.trim();
}
