// Formatting utilities terpusat untuk angka nominal (Rupiah) & kuantitas
// dengan delimiter ribuan ala Indonesia (titik sebagai pemisah ribuan).
// Dipakai di seluruh komponen & tabel — jangan format angka manual di luar sini.

const LOCALE = 'id-ID';

/**
 * Mengubah angka menjadi format mata uang Rupiah, contoh: 150000 -> "Rp 150.000".
 * Nilai desimal dibulatkan ke bilangan bulat terdekat (harga di sistem ini tanpa sen).
 */
export function formatRupiah(amount: number | string | null | undefined): string {
  const value = toNumber(amount);
  if (value === null) return 'Rp 0';
  const rounded = Math.round(value);
  return `Rp ${rounded.toLocaleString(LOCALE, { maximumFractionDigits: 0 })}`;
}

/**
 * Mengubah angka biasa/qty menjadi format dengan delimiter ribuan, contoh: 1500 -> "1.500".
 * `fractionDigits` opsional untuk qty desimal (mis. berat dalam kg).
 */
export function formatNumber(value: number | string | null | undefined, fractionDigits = 0): string {
  const num = toNumber(value);
  if (num === null) return '0';
  return num.toLocaleString(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * Mengubah string ber-delimiter (mis. hasil ketikan user di <AppInput>, "1.500.000" atau "1,500,000")
 * kembali menjadi number murni sebelum dikirim ke backend.
 */
export function parseNumber(formattedValue: string | number | null | undefined): number {
  if (formattedValue === null || formattedValue === undefined || formattedValue === '') return 0;
  if (typeof formattedValue === 'number') return formattedValue;
  // Buang semua karakter selain digit dan tanda minus di awal.
  const cleaned = formattedValue.replace(/[^\d-]/g, '');
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(num) ? null : num;
}
