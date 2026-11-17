'use client';

/* Latar blob Glass Minimal — port dari design/mockup.html (.bg/.blob/.grain).
   Animasi sangat pelan (40–58s), mati otomatis saat prefers-reduced-motion. */
export function BlobBackground() {
  return (
    <div className="bg" aria-hidden="true">
      <div className="blob a" />
      <div className="blob b" />
      <div className="blob c" />
      <div className="blob d" />
      <div className="grain" />
    </div>
  );
}
