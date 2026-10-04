/**
 * Mode bisnis POS per instance (build-time, seperti NEXT_PUBLIC_APP_NAME).
 *
 * - `fnb` (default): kasir restoran — Dine-in / Take Away, jumlah tamu, meja,
 *   TV antrian, tombol "Order" (open bill ke dapur).
 * - `retail` (Ballooney): kasir toko — langsung bayar; tanpa jenis order, tamu,
 *   meja, maupun antrian dapur. Order tetap tersimpan sebagai `takeaway`
 *   supaya laporan & integrasi lama tidak berubah.
 *
 * Set `NEXT_PUBLIC_POS_MODE=retail` di .env sebelum `next build`.
 */
export type PosBusinessMode = "fnb" | "retail";

export function resolvePosBusinessMode(value: string | undefined | null): PosBusinessMode {
  return String(value ?? "").trim().toLowerCase() === "retail" ? "retail" : "fnb";
}

export const POS_BUSINESS_MODE: PosBusinessMode = resolvePosBusinessMode(
  process.env.NEXT_PUBLIC_POS_MODE
);

export const IS_RETAIL_POS = POS_BUSINESS_MODE === "retail";

/** Jenis order yang dipakai kasir retail (tidak ditampilkan ke kasir). */
export const RETAIL_ORDER_TYPE = "takeaway" as const;

/** Label penjualan toko pengganti "Takeaway" di daftar order & laporan retail. */
export const RETAIL_SALE_LABEL = "Penjualan toko";
