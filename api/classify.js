export default async function handler(req, res) {
  // ── CORS headers ──────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ── Preflight ─────────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ── Method guard ──────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── API key guard ─────────────────────────────────────────────────────────
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    console.error('[classify] GEMINI_API_KEY is not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // ── Parse & validate body ─────────────────────────────────────────────────
  const { image, lang = 'ID' } = req.body ?? {};

  if (!image) {
    return res.status(400).json({ error: 'Missing required field: image' });
  }

  // ── Strip data URL prefix (e.g. "data:image/jpeg;base64,") ───────────────
  const base64Data = image.replace(/^data:[^;]+;base64,/, '');

  // ── Language-aware config ─────────────────────────────────────────────────
  const isEnglish = String(lang).toUpperCase() === 'EN';

  // ── Build system prompt ───────────────────────────────────────────────────
  const prompt = isEnglish
    ? buildPromptEN()
    : buildPromptID();

  // ── Call Gemini API ───────────────────────────────────────────────────────
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      response_mime_type: 'application/json',
    },
  };

  let geminiResponse;
  try {
    geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch (networkErr) {
    console.error('[classify] Network error calling Gemini:', networkErr);
    return res.status(500).json({ error: 'Internal server error' });
  }

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text().catch(() => '');
    console.error(
      `[classify] Gemini returned ${geminiResponse.status}: ${errorText}`
    );
    return res
      .status(geminiResponse.status)
      .json({ error: 'AI service error' });
  }

  // ── Parse Gemini response ─────────────────────────────────────────────────
  let geminiJson;
  try {
    geminiJson = await geminiResponse.json();
  } catch {
    console.error('[classify] Failed to parse Gemini HTTP response as JSON');
    return res.status(500).json({ error: 'Invalid AI response' });
  }

  const rawText =
    geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  let classified;
  try {
    classified = JSON.parse(rawText);
  } catch {
    console.error('[classify] Failed to JSON.parse Gemini text output:', rawText);
    return res.status(500).json({ error: 'Invalid AI response' });
  }

  // ── Return result ─────────────────────────────────────────────────────────
  return res.status(200).json(classified);
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────────────────────

function buildPromptID() {
  return `
Kamu adalah sistem klasifikasi sampah berbasis AI yang sangat akurat.
Analisis gambar yang diberikan dan kembalikan HANYA objek JSON yang valid sesuai skema di bawah ini — tanpa teks tambahan, tanpa markdown, tanpa penjelasan.

═══════════════════════════════════════════
SKEMA JSON (wajib diikuti persis):
═══════════════════════════════════════════
{
  "kategori"     : string,   // Satu dari: "ORGANIK" | "ANORGANIK" | "B3" | "TIDAK_TERDETEKSI" | "TIDAK_JELAS"
  "warna"        : string,   // Kode hex warna kategori: ORGANIK="#4A7C59", ANORGANIK="#5B7FA5", B3="#C75C5C"
  "nama_benda"   : string,   // Nama benda yang teridentifikasi, dalam Bahasa Indonesia (contoh: "Botol Plastik PET", "Kulit Pisang")
  "confidence"   : string,   // Tingkat keyakinan: "TINGGI" | "SEDANG" | "RENDAH"
  "waktu_terurai": string,   // Perkiraan waktu terurai yang mudah dibaca (contoh: "2-6 minggu", "450 tahun", "Tidak dapat terurai secara alami")
  "dampak"       : string,   // 1 kalimat singkat: dampak lingkungan jika dibuang ke tempat sampah umum
  "tips"         : string    // 1 kalimat singkat: cara pembuangan yang benar dan dapat langsung dilakukan
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
  (terbesar, paling dekat, paling menonjol).

• Jika benda merupakan CAMPURAN yang tidak dapat dipisahkan (misal: makanan dalam wadah plastik),
  gunakan kategori yang PALING BERBAHAYA (B3 > ANORGANIK > ORGANIK).

Kembalikan HANYA JSON. Mulai langsung dengan karakter '{'.
`.trim();
}

function buildPromptEN() {
  return `
You are a highly accurate AI-powered waste classification system.
Analyze the provided image and return ONLY a valid JSON object following the schema below — no extra text, no markdown, no explanation.

═══════════════════════════════════════════
JSON SCHEMA (must be followed exactly):
═══════════════════════════════════════════
{
  "kategori"     : string,   // One of: "ORGANIC" | "INORGANIC" | "HAZARDOUS" | "TIDAK_TERDETEKSI" | "TIDAK_JELAS"
  "warna"        : string,   // Category color hex: ORGANIC="#4A7C59", INORGANIC="#5B7FA5", HAZARDOUS="#C75C5C"
  "nama_benda"   : string,   // Name of the identified object in English (e.g. "PET Plastic Bottle", "Banana Peel")
  "confidence"   : string,   // Confidence level: "HIGH" | "MEDIUM" | "LOW"
  "waktu_terurai": string,   // Human-readable decomposition time estimate (e.g. "2-6 weeks", "450 years", "Does not decompose naturally")
  "dampak"       : string,   // 1 concise sentence: environmental impact if discarded in general waste
  "tips"         : string    // 1 concise actionable tip: correct disposal method
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
  (largest, closest, most prominent).

• If the item is an INSEPARABLE MIX (e.g., food inside a plastic container), use the
  MOST HAZARDOUS category (HAZARDOUS > INORGANIC > ORGANIC).

Return ONLY the JSON. Start directly with the '{' character.
`.trim();
}
