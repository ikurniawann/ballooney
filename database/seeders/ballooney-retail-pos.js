#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- seeder Node CommonJS, sama seperti seeder lain */
/**
 * Seeder: POS mode retail untuk instance Ballooney — matikan menu POS khusus F&B
 * dan metode bayar venue (gelang NFC); kartu diberi label EDC.
 *
 * Pasangan dari NEXT_PUBLIC_POS_MODE=retail (layar kasir tanpa Dine-in / Take
 * Away, jumlah tamu, meja, TV antrian, dan tombol "Order" ke dapur). Kodenya
 * tetap ada; menunya dinonaktifkan (is_active = false) sehingga tidak tampil di
 * sidebar DAN tidak lagi memberi akses ke API-nya. Jalankan ulang setelah
 * `iam-menus.sql` (seeder itu mengaktifkan kembali semua menu kanonis).
 *
 * Usage:
 *   node database/seeders/ballooney-retail-pos.js
 *   npm run db:seed:ballooney-retail-pos
 */

const { runSeeder } = require("./lib/ballooney-demo");

/** [kode menu, alasan] */
const FNB_MENUS = [
  ["pos.kitchen.kds", "Kitchen Display — layar dapur"],
  ["pos.kitchen.print-queue", "Antrian cetak checker order dapur/bar"],
  ["pos.kitchen.queue-board", "TV antrian pengambilan pesanan"],
  ["pos.operations.restaurant", "Denah restoran (tablet pramusaji)"],
  ["pos.operations.tables", "Master meja"],
  ["pos.operations.reservation", "Reservasi meja"],
  ["pos.operations.gofood", "Order GoFood / GoBiz"],
  ["pos.operations.cashier-classic", "Kasir classic F&B (tidak mendukung varian merchandise)"],
  ["pos.catalog.channel-prices", "Harga channel pesan-antar (markup GoFood/GrabFood)"],
];

/** Metode bayar: gelang NFC (venue/ticketing) tidak dipakai toko; kartu = EDC. */
const PAYMENT_METHODS_OFF = ["nfc_tab"];
const PAYMENT_METHOD_RENAMES = [["credit_card", "Kartu Debit/Kredit", "EDC — Debit, Visa, Mastercard, GPN"]];

/** Grup menu yang tersisa diberi nama netral retail. */
const RENAMES = [["pos.kitchen", "Printer & Struk"]];

runSeeder("Seeding POS mode retail", async (c) => {
  for (const [code, why] of FNB_MENUS) {
    const { rowCount } = await c.query(
      `UPDATE iam.menus SET is_active = false, is_visible = false, updated_at = NOW()
       WHERE code = $1 AND (is_active OR is_visible)`,
      [code]
    );
    console.log(`  ${rowCount ? "✓ dimatikan" : "· sudah mati"}  ${code.padEnd(32)} ${why}`);
  }
  for (const [code, name] of RENAMES) {
    await c.query(`UPDATE iam.menus SET menu_name = $2, updated_at = NOW() WHERE code = $1`, [code, name]);
    console.log(`  ✓ ${code} → "${name}"`);
  }
  const off = await c.query(
    `UPDATE pos.payment_methods SET is_active = false, updated_at = NOW()
     WHERE code = ANY($1::text[]) AND is_active`,
    [PAYMENT_METHODS_OFF]
  );
  console.log(`  ✓ metode bayar F&B/venue dimatikan: ${PAYMENT_METHODS_OFF.join(", ")} (${off.rowCount})`);
  for (const [code, name, description] of PAYMENT_METHOD_RENAMES) {
    await c.query(
      `UPDATE pos.payment_methods SET name = $2, description = $3, updated_at = NOW() WHERE code = $1`,
      [code, name, description]
    );
    console.log(`  ✓ metode bayar ${code} → "${name}"`);
  }
  return { "menu F&B dimatikan": FNB_MENUS.length, "metode bayar dimatikan": PAYMENT_METHODS_OFF.length };
});
