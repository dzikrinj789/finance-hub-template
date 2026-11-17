// Util gambar Memory: terima semua format gambar (input accept="image/*"),
// file kecil disimpan apa adanya (GIF animasi awet), file besar dikompres
// client-side via canvas (max 1600px, JPEG 0.82) agar hemat kolom DB.

const SMALL_FILE_LIMIT = 1.2 * 1024 * 1024; // ≤1.2MB → simpan original apa adanya
const MAX_DIM = 1600;

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Gagal membaca file gambar'));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Format gambar tidak bisa dibuka browser ini'));
    img.src = src;
  });
}

export async function fileToMemoryImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`"${file.name}" bukan file gambar`);
  }
  // File kecil (termasuk GIF) → original, tanpa ubah se-pixel pun
  if (file.size <= SMALL_FILE_LIMIT) return readAsDataURL(file);
  // File besar → kompres via canvas
  const originalURL = URL.createObjectURL(file);
  try {
    const img = await loadImage(originalURL);
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return readAsDataURL(file);
    // Background putih (JPEG tidak kenal transparan)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(originalURL);
  }
}

export function isProbablyImageUrl(s: string): boolean {
  const v = (s || '').trim();
  if (/^data:image\//i.test(v)) return true;
  return /^https?:\/\/.+/i.test(v);
}
