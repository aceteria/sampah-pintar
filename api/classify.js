export const config = {
  runtime: 'edge',
};

export default async function handler(req, res) {
  // ── CORS headers ──────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
    temperature: 0.2,
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
      classified.waktu_terurai = classified.waktu_terurai || 'Unknown time';
      classified.dampak = classified.dampak || 'No impact information provided.';
      classified.tips = classified.tips || 'Dispose of responsibly.';
      classified.reasoning_summary = classified.reasoning_summary || 'Analyzed via image recognition.';
    }
  } catch {
    console.error('[classify] Failed to parse JSON output:', rawText);
    // Return a partial failure rather than a 500 crash so UI handles it gracefully
    const errorResponse = {
      kategori: 'TIDAK_JELAS',
      warna: '#888888',
      nama_benda: 'Parse Error',
      confidence: 'RENDAH',
      waktu_terurai: '',
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
  "warna"            : string,   // Kode hex warna kategori: ORGANIK="#4A7C59", ANORGANIK="#5B7FA5", B3="#C75C5C"
  "nama_benda"       : string,   // Nama benda yang teridentifikasi, dalam Bahasa Indonesia (contoh: "Botol Plastik PET", "Kulit Pisang")
  "confidence"       : string,   // Tingkat keyakinan: "TINGGI" | "SEDANG" | "RENDAH"
  "waktu_terurai"    : string,   // Perkiraan waktu terurai yang mudah dibaca (contoh: "2-6 minggu", "450 tahun", "Tidak dapat terurai secara alami")
  "dampak"           : string,   // 1 kalimat singkat: dampak lingkungan jika dibuang ke tempat sampah umum
  "tips"             : string,   // 1 kalimat singkat: cara pembuangan yang benar dan dapat langsung dilakukan
  "reasoning_summary": string    // 1 kalimat singkat menjelaskan alasan benda ini dikategorikan demikian untuk meyakinkan pengguna (contoh: "Terdeteksi plastik PET #1 yang tidak mudah terurai, sehingga masuk anorganik.")
}

═══════════════════════════════════════════
DEFINISI KATEGORI:
═══════════════════════════════════════════
• ORGANIK (#4A7C59)    — Bahan yang berasal dari makhluk hidup dan dapat terurai secara alami oleh
                         mikroorganisme. Contoh: sisa makanan, kulit buah, daun kering, kertas kotor,
                         tulang, ampas kopi/teh.

• ANORGANIK (#5B7FA5)  — Bahan yang tidak dapat terurai secara alami atau memerlukan waktu sangat
                         lama. Dapat didaur ulang. Contoh: botol plastik, kaleng aluminium, kaca,
                         kardus bersih, kertas bersih, logam, karet, styrofoam.
                         PENTING: Kemasan minuman kotak (Tetra Pak) adalah ANORGANIK, bukan Organik.

• B3 (#C75C5C)         — Bahan Berbahaya dan Beracun. Mengandung zat kimia berbahaya yang berisiko
                         mencemari tanah, air, dan udara. Contoh: baterai, lampu neon/CFL,
                         elektronik/e-waste, cat, pestisida, obat-obatan kadaluarsa, pembersih kimia,
                         tinta printer, oli bekas.

═══════════════════════════════════════════
PANDUAN CONFIDENCE:
═══════════════════════════════════════════
• TINGGI — Objek terlihat jelas, terfokus, dan mudah diidentifikasi dengan pasti.
• SEDANG — Objek dapat diidentifikasi namun ada sedikit ambiguitas (blur ringan, sebagian tertutup,
           sudut pandang tidak ideal).
• RENDAH — Objek sulit diidentifikasi (sangat blur, gelap, tertutup sebagian besar, atau komposit
           dari beberapa jenis benda).

═══════════════════════════════════════════
PANDUAN WAKTU_TERURAI:
═══════════════════════════════════════════
Gunakan perkiraan ilmiah yang umum diketahui. Contoh referensi:
- Kulit buah/sayuran: "2-4 minggu"
- Kertas: "2-5 bulan"
- Kardus: "2 bulan"
- Karet/ban: "50-80 tahun"
- Kaleng aluminium: "80-200 tahun"
- Botol plastik: "450 tahun"
- Kantong plastik: "10-20 tahun"
- Styrofoam: "Lebih dari 500 tahun"
- Kaca: "Lebih dari 1 juta tahun"
- Baterai: "Tidak dapat terurai, mengandung logam berat"
- E-waste: "Tidak dapat terurai, mengandung bahan beracun"

═══════════════════════════════════════════
PENANGANAN KASUS TEPI:
═══════════════════════════════════════════
• Jika gambar TIDAK MENGANDUNG BENDA APAPUN (gambar kosong, hanya tekstur/latar belakang, layar hitam):
  Kembalikan: { "kategori": "TIDAK_TERDETEKSI", "warna": "#888888", "nama_benda": "", "confidence": "RENDAH", "waktu_terurai": "", "dampak": "", "tips": "" }

• Jika gambar mengandung benda tetapi TIDAK DAPAT DIKLASIFIKASI dengan cukup keyakinan (gambar terlalu
  blur, terlalu gelap, benda tidak dikenal, atau campuran berbagai jenis sampah yang tidak dominan):
  Kembalikan: { "kategori": "TIDAK_JELAS", "warna": "#888888", "nama_benda": "Tidak dapat diidentifikasi", "confidence": "RENDAH", "waktu_terurai": "", "dampak": "Tidak dapat ditentukan karena gambar tidak cukup jelas.", "tips": "Coba ambil foto lebih dekat dengan pencahayaan yang baik." }

• Jika ada BEBERAPA BENDA dalam satu gambar, klasifikasi berdasarkan benda yang PALING DOMINAN
  (terbesar, paling dekat, paling menonjol). Fokus hanya pada SATU benda tersebut.

• Jika benda merupakan CAMPURAN yang tidak dapat dipisahkan (misal: makanan dalam wadah plastik),
  gunakan kategori yang PALING BERBAHAYA (B3 > ANORGANIK > ORGANIK).

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
  "nama_benda"       : string,   // Name of the identified object in English (e.g. "PET Plastic Bottle", "Banana Peel")
  "confidence"       : string,   // Confidence level: "HIGH" | "MEDIUM" | "LOW"
  "waktu_terurai"    : string,   // Human-readable decomposition time estimate (e.g. "2-6 weeks", "450 years", "Does not decompose naturally")
  "dampak"           : string,   // 1 concise sentence: environmental impact if discarded in general waste
  "tips"             : string,   // 1 concise actionable tip: correct disposal method
  "reasoning_summary": string    // 1 concise sentence explaining why this item was categorized as such to build user trust (e.g. "Detected #1 PET plastic which doesn't decompose, so it's inorganic.")
}

═══════════════════════════════════════════
CATEGORY DEFINITIONS:
═══════════════════════════════════════════
• ORGANIC (#4A7C59)    — Materials originating from living organisms that decompose naturally via
                         microorganisms. Examples: food scraps, fruit peels, dry leaves, dirty paper,
                         bones, coffee/tea grounds.

• INORGANIC (#5B7FA5)  — Materials that do not decompose naturally or take an extremely long time.
                         Can be recycled. Examples: plastic bottles, aluminum cans, glass, clean
                         cardboard, clean paper, metal, rubber, styrofoam.
                         IMPORTANT: Beverage cartons (Tetra Pak) are INORGANIC, not Organic.

• HAZARDOUS (#C75C5C)  — Hazardous and Toxic Waste. Contains chemical substances that risk
                         contaminating soil, water, and air. Examples: batteries, fluorescent/CFL
                         bulbs, electronics/e-waste, paint, pesticides, expired medications,
                         chemical cleaners, printer ink, used motor oil.

═══════════════════════════════════════════
CONFIDENCE GUIDELINES:
═══════════════════════════════════════════
• HIGH   — Object is clearly visible, in focus, and can be identified with certainty.
• MEDIUM — Object is identifiable but with slight ambiguity (mild blur, partially obscured,
           non-ideal angle).
• LOW    — Object is difficult to identify (very blurry, dark, mostly obscured, or a composite
           of several item types).

═══════════════════════════════════════════
DECOMPOSITION TIME GUIDELINES:
═══════════════════════════════════════════
Use well-known scientific estimates. Reference examples:
- Fruit/vegetable peels: "2-4 weeks"
- Paper: "2-5 months"
- Cardboard: "2 months"
- Rubber/tires: "50-80 years"
- Aluminum can: "80-200 years"
- Plastic bottle: "450 years"
- Plastic bag: "10-20 years"
- Styrofoam: "500+ years"
- Glass: "1 million+ years"
- Battery: "Does not decompose, contains heavy metals"
- E-waste: "Does not decompose, contains toxic materials"

═══════════════════════════════════════════
EDGE CASE HANDLING:
═══════════════════════════════════════════
• If the image CONTAINS NO OBJECT (blank image, only background/texture, black screen):
  Return: { "kategori": "TIDAK_TERDETEKSI", "warna": "#888888", "nama_benda": "", "confidence": "LOW", "waktu_terurai": "", "dampak": "", "tips": "" }

• If the image contains an object but CANNOT BE CLASSIFIED with sufficient confidence (too blurry,
  too dark, unknown item, or a mix of waste types with no dominant item):
  Return: { "kategori": "TIDAK_JELAS", "warna": "#888888", "nama_benda": "Cannot be identified", "confidence": "LOW", "waktu_terurai": "", "dampak": "Cannot be determined as the image is not clear enough.", "tips": "Try taking a closer photo with better lighting." }

• If there are MULTIPLE OBJECTS in the image, classify based on the MOST DOMINANT item
  (largest, closest, most prominent). Focus strictly on that ONE item.

• If the item is an INSEPARABLE MIX (e.g., food inside a plastic container), use the
  MOST HAZARDOUS category (HAZARDOUS > INORGANIC > ORGANIC).

Make sure to output the \`\`\`json ... \`\`\` block at the end of your response.
`.trim();
}
