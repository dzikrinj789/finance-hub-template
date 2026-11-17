// Registry tulisan-lokal: id yang baru saja ditulis oleh tab/device ini sendiri.
// Dipakai agar echo tulisan sendiri (via Supabase Realtime) tidak memicu notifikasi
// lonceng — yang bunyi hanya isi dari device/orang lain. Sinkronisasi state tetap jalan.

const recent = new Map<string, number>();

const SELF_WRITE_TTL_MS = 8000;

export function markSelfWrite(table: string, id: string) {
  if (!table || !id) return;
  recent.set(`${table}:${id}`, Date.now() + SELF_WRITE_TTL_MS);
  // Hygiene ringan: buang entri yang sudah kedaluwarsa saat map membesar
  if (recent.size > 200) {
    const now = Date.now();
    recent.forEach((until, key) => {
      if (until < now) recent.delete(key);
    });
  }
}

export function isSelfWrite(table: string, id: string): boolean {
  if (!table || !id) return false;
  const key = `${table}:${id}`;
  const until = recent.get(key);
  if (until === undefined) return false;
  if (until < Date.now()) {
    recent.delete(key);
    return false;
  }
  return true;
}
