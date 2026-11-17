// Parser halaman harga emas Galeri24 (https://galeri24.co.id/harga-emas).
// Murni fungsi (tanpa fetch) agar mudah diuji. Dipakai oleh /api/gold-price.

const MONTHS: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
};

export interface ParsedPrice {
  pricePerGram: number;
  sellingPricePerGram?: number;
  recordedDate: string;
  updatedLabel: string;
}

const toNumber = (s: string) => Number(String(s).replace(/[^0-9]/g, ''));

function decodeText(s: string): string {
  return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

/** Parse blok vendor (mis. ANTAM) dari HTML Galeri24. Diekspor untuk pengujian. */
export function parseGaleri24(html: string, vendor = 'ANTAM'): ParsedPrice | null {
  const start = html.indexOf(`id="${vendor}"`);
  if (start < 0) return null;
  // Blok berakhir di blok vendor berikutnya (<div id="...">) atau ±20 KB
  const nextIdx = html.indexOf('<div id="', start + 10);
  const block = html.slice(start, nextIdx > start ? nextIdx : start + 20000);
  const tokens = [...block.matchAll(/>([^<>]+)</g)].map((m) => decodeText(m[1])).filter(Boolean);

  // Tanggal: "Diperbarui Sabtu, 31 Oktober 2026"
  const dateTok = tokens.find((t) => /^Diperbarui\b/i.test(t)) ?? '';
  const dm = /Diperbarui\s+(?:[A-Za-z]+,\s*)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i.exec(dateTok);
  let recordedDate = '';
  if (dm) {
    const mon = MONTHS[dm[2].toLowerCase()];
    if (mon) recordedDate = `${dm[3]}-${String(mon).padStart(2, '0')}-${String(Number(dm[1])).padStart(2, '0')}`;
  }
  const updatedLabel = dateTok.replace(/^Diperbarui\s*/i, '').trim();

  // Header kolom: Berat | Harga Jual | Harga Buyback → baris berikutnya triplet
  const hdr = tokens.findIndex((t) => /^Harga Buyback$/i.test(t));
  if (hdr < 0) return null;
  const rows = tokens.slice(hdr + 1);
  for (let i = 0; i + 2 < rows.length; i++) {
    const w = rows[i].replace(',', '.');
    if ((w === '1' || w === '1.0') && /^Rp/i.test(rows[i + 1]) && /^Rp/i.test(rows[i + 2])) {
      const sell = toNumber(rows[i + 1]);
      const buyback = toNumber(rows[i + 2]);
      // Sanity: harga 1 gram wajar (Rp 500rb – Rp 10jt), buyback < jual
      if (!buyback || buyback < 500_000 || buyback > 10_000_000) return null;
      if (sell && buyback > sell) return null;
      return { pricePerGram: buyback, sellingPricePerGram: sell || undefined, recordedDate, updatedLabel };
    }
  }
  return null;
}
