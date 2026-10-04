#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- seeder Node CommonJS, sama seperti seeder lain */
/**
 * Seeder demo Transfer Stok Toko (multi-toko, EPIC-052): tiga transfer dengan
 * status berbeda supaya halaman Transfer Stok Toko & kartu stok langsung berisi.
 *
 * SAAT INI DILEWATI: Ballooney baru punya satu lokasi (Toko & Workshop Gading
 * Serpong, BALLOONEY-HQ) — tidak ada toko lain untuk tujuan transfer. Seeder
 * keluar dengan aman (tanpa menyentuh stok) selama cabang di TRANSFERS belum
 * aktif semua. Begitu toko kedua ditambahkan di ballooney-business-structure.js,
 * ganti kode cabang contoh (BALLOONEY-TOKO-2) di bawah dengan kode sebenarnya:
 *
 *   1. Gudang Gading Serpong → Toko 2    diterima 3 hari lalu (restock varian yang habis di toko)
 *   2. Gudang Gading Serpong → Toko 2    dalam pengiriman (dikirim kemarin, balon foil)
 *   3. Toko 2 → Gudang Gading Serpong    draft (retur balon latex yang lambat laku)
 *
 * Stok berpindah lewat fungsi SQL yang sama dengan aplikasi
 * (pos.pos_stock_transfer_send/receive). Idempoten: transfer demo lama
 * (catatan berawalan "DEMO") dibalik efek stoknya lalu dihapus sebelum dibuat ulang.
 * Prasyarat: ballooney-structure, ballooney-catalog (produk multi-toko).
 *
 * Usage:
 *   node database/seeders/ballooney-demo-store-transfers.js
 *   npm run db:seed:ballooney-store-transfers
 */

const { runSeeder, anyAdmin } = require("./lib/ballooney-demo");

const DEMO_PREFIX = "DEMO";

/** [kode cabang asal, kode cabang tujuan, status akhir, hari lalu, catatan, pemilih varian] */
const TRANSFERS = [
  {
    from: "BALLOONEY-HQ",
    to: "BALLOONEY-TOKO-2",
    status: "received",
    daysAgo: 3,
    notes: `${DEMO_PREFIX} — Restock mingguan Toko 2: varian balon yang habis di toko`,
    pick: { mode: "empty_at_destination", limit: 6, qty: 4 },
  },
  {
    from: "BALLOONEY-HQ",
    to: "BALLOONEY-TOKO-2",
    status: "sent",
    daysAgo: 1,
    notes: `${DEMO_PREFIX} — Kiriman balon foil angka & huruf untuk musim wisuda (kurir internal)`,
    pick: { mode: "category", category: "Balon Foil", limit: 5, qty: 3 },
  },
  {
    from: "BALLOONEY-TOKO-2",
    to: "BALLOONEY-HQ",
    status: "draft",
    daysAgo: 0,
    notes: `${DEMO_PREFIX} — Usulan retur balon latex yang lambat laku ke gudang Gading Serpong`,
    pick: { mode: "category", category: "Balon Latex & Helium", limit: 3, qty: 2 },
  },
];

/** Cabang di TRANSFERS yang belum ada/aktif (punya stall default aktif). */
async function missingBranches(c) {
  const codes = [...new Set(TRANSFERS.flatMap((t) => [t.from, t.to]))];
  const { rows } = await c.query(
    `SELECT DISTINCT b.code FROM configuration.branches b
     JOIN configuration.warehouses w ON w.branch_id = b.id AND w.is_active AND w.is_default
     WHERE b.code = ANY($1::text[]) AND b.is_active`,
    [codes]
  );
  const found = new Set(rows.map((r) => r.code));
  return codes.filter((code) => !found.has(code));
}

async function stallOf(c, branchCode) {
  const { rows } = await c.query(
    `SELECT w.id, w.name FROM configuration.warehouses w
     JOIN configuration.branches b ON b.id = w.branch_id
     WHERE b.code = $1 AND w.is_active AND w.is_default LIMIT 1`,
    [branchCode]
  );
  if (!rows[0]) throw new Error(`Stall cabang ${branchCode} tidak ada — jalankan ballooney-structure dulu`);
  return rows[0];
}

/** Balik efek stok transfer demo lama lalu hapus (beserta kartu stoknya). */
async function removeOldDemoTransfers(c) {
  const { rows: old } = await c.query(
    `SELECT id, status, from_warehouse_id, to_warehouse_id FROM pos.pos_stock_transfers
     WHERE notes LIKE $1`,
    [`${DEMO_PREFIX}%`]
  );
  for (const t of old) {
    const { rows: items } = await c.query(
      `SELECT sku_id, qty FROM pos.pos_stock_transfer_items WHERE transfer_id = $1`,
      [t.id]
    );
    await c.query(`SELECT set_config('pos.sku_stock_sync', 'on', true)`);
    for (const item of items) {
      if (t.status === "sent" || t.status === "received") {
        await c.query(
          `UPDATE pos.pos_sku_stock_locations SET stock_quantity = stock_quantity + $3
           WHERE sku_id = $1 AND warehouse_id = $2`,
          [item.sku_id, t.from_warehouse_id, item.qty]
        );
      }
      if (t.status === "received") {
        await c.query(
          `UPDATE pos.pos_sku_stock_locations SET stock_quantity = stock_quantity - $3
           WHERE sku_id = $1 AND warehouse_id = $2`,
          [item.sku_id, t.to_warehouse_id, item.qty]
        );
      }
    }
    for (const item of items) {
      await c.query(`SELECT pos.pos_sync_sku_total($1)`, [item.sku_id]);
    }
    await c.query(
      `DELETE FROM pos.pos_sku_stock_movements WHERE reference_type = 'stock_transfer' AND reference_id = $1`,
      [t.id]
    );
    await c.query(`DELETE FROM pos.pos_stock_transfers WHERE id = $1`, [t.id]);
  }
  return old.length;
}

async function pickSkus(c, pick, fromId, toId) {
  if (pick.mode === "empty_at_destination") {
    const { rows } = await c.query(
      `SELECT s.id, s.sku FROM pos.pos_sku_stock_locations dst
       JOIN pos.pos_sku_stock_locations src ON src.sku_id = dst.sku_id AND src.warehouse_id = $2
       JOIN pos.pos_product_skus s ON s.id = dst.sku_id AND s.is_active
       WHERE dst.warehouse_id = $1 AND dst.stock_quantity = 0 AND src.stock_quantity >= $3
       ORDER BY s.sku LIMIT $4`,
      [toId, fromId, pick.qty, pick.limit]
    );
    return rows;
  }
  const { rows } = await c.query(
    `SELECT s.id, s.sku FROM pos.pos_product_skus s
     JOIN pos.pos_products p ON p.id = s.product_id AND p.store_scope = 'all'
     JOIN pos.pos_categories cat ON cat.id = p.category_id AND cat.name = $3
     JOIN pos.pos_sku_stock_locations src ON src.sku_id = s.id AND src.warehouse_id = $1
     WHERE s.is_active AND src.stock_quantity >= $2
     ORDER BY s.sku LIMIT $4`,
    [fromId, pick.qty, pick.category, pick.limit]
  );
  return rows;
}

runSeeder("Seeding demo Transfer Stok Toko", async (c) => {
  // Satu lokasi saja → tidak ada yang bisa ditransfer; keluar tanpa menyentuh stok.
  const missing = await missingBranches(c);
  if (missing.length > 0) {
    console.log(`  ! cabang belum ada/aktif: ${missing.join(", ")} — transfer demo butuh minimal 2 lokasi aktif`);
    return { "transfer demo": "dilewati — hanya 1 lokasi" };
  }

  const admin = await anyAdmin(c);
  const userId = admin?.id ?? null;
  const removed = await removeOldDemoTransfers(c);
  if (removed) console.log(`  ↺ ${removed} transfer demo lama dibalik & dihapus`);

  const summary = [];
  for (const def of TRANSFERS) {
    const from = await stallOf(c, def.from);
    const to = await stallOf(c, def.to);
    const skus = await pickSkus(c, def.pick, from.id, to.id);
    if (skus.length === 0) {
      console.log(`  ! ${from.name} → ${to.name}: tidak ada varian yang cocok, dilewati`);
      continue;
    }
    const at = `now() - interval '${def.daysAgo} days'`;
    const { rows } = await c.query(
      `INSERT INTO pos.pos_stock_transfers (transfer_no, from_warehouse_id, to_warehouse_id, notes, created_by, created_at)
       VALUES (pos.pos_next_stock_transfer_no(), $1, $2, $3, $4, ${at} - interval '2 hours')
       RETURNING id, transfer_no`,
      [from.id, to.id, def.notes, userId]
    );
    const transfer = rows[0];
    for (const sku of skus) {
      await c.query(
        `INSERT INTO pos.pos_stock_transfer_items (transfer_id, sku_id, qty) VALUES ($1, $2, $3)`,
        [transfer.id, sku.id, def.pick.qty]
      );
    }
    if (def.status === "sent" || def.status === "received") {
      await c.query(`SELECT pos.pos_stock_transfer_send($1, $2)`, [transfer.id, userId]);
      await c.query(
        `UPDATE pos.pos_stock_transfers SET sent_at = ${at} - interval '1 hour' WHERE id = $1`,
        [transfer.id]
      );
      await c.query(
        `UPDATE pos.pos_sku_stock_movements SET created_at = ${at} - interval '1 hour'
         WHERE reference_id = $1 AND movement_type = 'transfer_out'`,
        [transfer.id]
      );
    }
    if (def.status === "received") {
      await c.query(`SELECT pos.pos_stock_transfer_receive($1, $2)`, [transfer.id, userId]);
      await c.query(`UPDATE pos.pos_stock_transfers SET received_at = ${at} WHERE id = $1`, [transfer.id]);
      await c.query(
        `UPDATE pos.pos_sku_stock_movements SET created_at = ${at}
         WHERE reference_id = $1 AND movement_type = 'transfer_in'`,
        [transfer.id]
      );
    }
    summary.push(`${transfer.transfer_no} ${def.status}`);
    console.log(
      `  ✓ ${transfer.transfer_no} ${from.name} → ${to.name}: ${skus.length} varian × ${def.pick.qty} pcs [${def.status}]`
    );
  }

  const { rows: check } = await c.query(
    `SELECT count(*)::int AS n FROM pos.pos_product_skus s
     WHERE EXISTS (SELECT 1 FROM pos.pos_sku_stock_locations l WHERE l.sku_id = s.id)
       AND s.stock_quantity <> (SELECT COALESCE(SUM(l.stock_quantity), 0) FROM pos.pos_sku_stock_locations l WHERE l.sku_id = s.id)`
  );
  if (check[0].n > 0) throw new Error(`Total ${check[0].n} varian tidak sama dengan SUM stok lokasi`);

  return { transfer: summary.join(", ") };
});
