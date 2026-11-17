/**
 * DEV-ONLY UI preview flag.
 *
 * Aktif HANYA jika dev server dijalankan dengan env inline
 * `NEXT_PUBLIC_UI_PREVIEW=1 npm run dev` DAN bukan build production.
 * Saat aktif: login redirect dilewati dan FinanceContext diisi data contoh
 * (src/lib/preview-data.ts) tanpa menyentuh Supabase sama sekali.
 *
 * Di production (`next build`), NODE_ENV === 'production' sehingga konstanta ini
 * selalu `false` dan seluruh cabang preview ter-eliminasi (dead code).
 */
export const IS_UI_PREVIEW =
  process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_UI_PREVIEW === '1';
