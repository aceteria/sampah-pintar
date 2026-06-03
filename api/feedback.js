export const config = {
  runtime: 'edge',
};

const SUPABASE_URL = 'https://moohlelqiaspdsqdytsr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vb2hsZWxxaWFzcGRzcWR5dHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDkwMDQsImV4cCI6MjA5NjAyNTAwNH0.PWiuF25LbfhsdX-Do_Wugu7qSq_IWZ8hkN2-B1xgnWU';

export default async function handler(req) {
  // ── CORS headers ──────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const body = await req.json();
    const { image, kategori, material_id, is_correct } = body;

    let imageUrl = null;

    if (image) {
      // 1. Upload image to Supabase Storage
      const base64Data = image.replace(/^data:[^;]+;base64,/, '');
      const binaryStr = atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      
      const filename = `feedback_${crypto.randomUUID()}.jpg`;
      
      const storageRes = await fetch(`${SUPABASE_URL}/storage/v1/object/images/${filename}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'image/jpeg'
        },
        body: bytes
      });

      if (storageRes.ok) {
        imageUrl = `${SUPABASE_URL}/storage/v1/object/public/images/${filename}`;
      } else {
        console.error('[feedback] Storage upload failed:', await storageRes.text());
      }
    }

    // 2. Insert record into feedback table
    const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        image_url: imageUrl,
        kategori: kategori || 'UNKNOWN',
        material_id: material_id || 'UNKNOWN',
        is_correct: !!is_correct
      })
    });

    if (!dbRes.ok) {
      console.error('[feedback] Database insert failed:', await dbRes.text());
      return new Response(JSON.stringify({ error: 'Failed to save feedback' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  } catch (error) {
    console.error('[feedback] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
}
