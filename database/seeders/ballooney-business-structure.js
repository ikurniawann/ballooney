#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- seeder Node CommonJS, sama seperti seeder lain */
/**
 * Seeder: struktur bisnis Ballooney — holding → company → cabang (lokasi) → stall.
 *
 *   CV Balon Jaya (holding)
 *   └─ Ballooney (company)
 *      └─ Ballooney Gading Serpong, Kab. Tangerang   toko + workshop produksi (balon, bunga, dekorasi)
 *
 * Satu cabang = satu lokasi fisik (scope user, laporan, shift, struk). Sumber
 * lokasi (publik, dicek 2026-10-04): ballooney.co.id/contact-us — "Ruko
 * Fluorite No.66 Gading Serpong, Tangerang". Situs tidak mencantumkan toko
 * lain; cabang/toko baru cukup ditambah satu entri di LOCATIONS (kind
 * flagship | mall) dan stok per toko + transfer stok otomatis berlaku.
 * Jam buka = ASUMSI demo.
 *
 * Mengisi (idempoten):
 *   - configuration.holdings / companies / branches / warehouses
 *   - item.brands                cermin cabang (trigger sync_branch_to_brands) → industri Retail
 *   - pos.pos_receipt_settings   header struk per cabang (nama toko + alamat)
 *   - pos.pos_billing_profiles   tidak disentuh (profil default berlaku semua cabang)
 *
 * Migrasi data lama: instance ini dikloning dari DB Paddy; cabang HQ + stall
 * "GUDANG-PUSAT" di-rename menjadi cabang Gading Serpong / stall TOKO — id tetap,
 * jadi produk, stok, PO, dan jurnal yang sudah menunjuk ke sana tidak berubah.
 * Cabang lain yang tidak ada di LOCATIONS dinonaktifkan.
 *
 * Usage:
 *   node database/seeders/ballooney-business-structure.js
 *   npm run db:seed:ballooney-structure
 */

const { loadEnv } = require("./lib/ballooney-demo");
const { Client } = require("pg");
const { sslForUrl, assertLocalTarget } = require("../scripts/pg-utils");

const HOLDING = { code: "CBJ", name: "CV Balon Jaya" };
const COMPANY = { code: "BALLOONEY", name: "Ballooney" };

/**
 * kind: hq | flagship | mall. Stall pertama = default cabang.
 * receipt: baris header struk (nama tampil + alamat).
 */
const LOCATIONS = [
  {
    code: "BALLOONEY-HQ",
    name: "Ballooney Gading Serpong",
    kind: "hq",
    city: "Kab. Tangerang",
    address: "Ruko Fluorite No. 66, Gading Serpong, Kab. Tangerang, Banten",
    hours: "Setiap hari 09.00–18.00",
    legacy: { branch: "BALLOONEY-HQ", warehouse: "GUDANG-PUSAT" },
    stalls: [
      { code: "TOKO", name: "Toko & Workshop Gading Serpong", note: "Toko, produksi gift & dekorasi, gudang bahan dan aset sewa" },
    ],
  },
];

const RECEIPT_FOOTER = [
  "Terima kasih sudah berbelanja di Ballooney!",
  "IG @ballooney.id · ballooney.co.id · WA 0857-7577-8802",
  "Delivering Happiness Since 2016",
];

async function upsertOne(c, { select, selectParams, update, updateParams, insert, insertParams }) {
  const { rows } = await c.query(select, selectParams);
  if (rows[0]) {
    await c.query(update, [rows[0].id, ...updateParams]);
    return { id: rows[0].id, created: false };
  }
  const ins = await c.query(insert, insertParams);
  return { id: ins.rows[0].id, created: true };
}

async function main() {
  loadEnv();
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("ERROR: Set MIGRATE_DATABASE_URL / DATABASE_URL di .env / .env.local");
    process.exit(1);
  }
  try {
    assertLocalTarget(url, "MIGRATE_DATABASE_URL");
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const c = new Client({ connectionString: url, ssl: sslForUrl(url) });
  await c.connect();
  try {
    await c.query("BEGIN");

    // ── Holding & company ────────────────────────────────────────────────────
    // Instance awal hanya punya satu holding/company: ambil yang ada bila kodenya
    // berbeda, supaya id lama (dipakai COA, CRM, appearance) tetap.
    const holding = await upsertOne(c, {
      select: `SELECT id FROM configuration.holdings WHERE code = $1
               UNION ALL SELECT id FROM configuration.holdings WHERE (SELECT count(*) FROM configuration.holdings) = 1
               LIMIT 1`,
      selectParams: [HOLDING.code],
      update: `UPDATE configuration.holdings SET code = $2, name = $3, is_active = true, updated_at = NOW() WHERE id = $1`,
      updateParams: [HOLDING.code, HOLDING.name],
      insert: `INSERT INTO configuration.holdings (code, name, is_active) VALUES ($1, $2, true) RETURNING id`,
      insertParams: [HOLDING.code, HOLDING.name],
    });
    const company = await upsertOne(c, {
      select: `SELECT id FROM configuration.companies WHERE code = $1 AND holding_id = $2
               UNION ALL SELECT id FROM configuration.companies WHERE holding_id = $2
                 AND (SELECT count(*) FROM configuration.companies WHERE holding_id = $2) = 1
               LIMIT 1`,
      selectParams: [COMPANY.code, holding.id],
      update: `UPDATE configuration.companies SET code = $2, name = $3, is_active = true, updated_at = NOW() WHERE id = $1`,
      updateParams: [COMPANY.code, COMPANY.name],
      insert: `INSERT INTO configuration.companies (holding_id, code, name, is_active) VALUES ($1, $2, $3, true) RETURNING id`,
      insertParams: [holding.id, COMPANY.code, COMPANY.name],
    });
    console.log(`  ✓ ${HOLDING.name} → ${COMPANY.name}`);

    // ── Cabang & stall ──────────────────────────────────────────────────────
    let stallCount = 0;
    for (const loc of LOCATIONS) {
      // Cabang/stall lama dari instalasi awal → rename di tempat (id dipertahankan).
      if (loc.legacy) {
        await c.query(
          `UPDATE configuration.branches SET code = $3, updated_at = NOW()
           WHERE company_id = $1 AND code = $2
             AND NOT EXISTS (SELECT 1 FROM configuration.branches WHERE company_id = $1 AND code = $3)`,
          [company.id, loc.legacy.branch, loc.code]
        );
      }
      const branch = await upsertOne(c, {
        select: `SELECT id FROM configuration.branches WHERE company_id = $1 AND code = $2 LIMIT 1`,
        selectParams: [company.id, loc.code],
        update: `UPDATE configuration.branches SET name = $2, is_active = true, updated_at = NOW() WHERE id = $1`,
        updateParams: [loc.name],
        insert: `INSERT INTO configuration.branches (company_id, code, name, is_active) VALUES ($1, $2, $3, true) RETURNING id`,
        insertParams: [company.id, loc.code, loc.name],
      });

      for (const [i, stall] of loc.stalls.entries()) {
        if (loc.legacy && i === 0) {
          await c.query(
            `UPDATE configuration.warehouses SET code = $3, updated_at = NOW()
             WHERE branch_id = $1 AND code = $2
               AND NOT EXISTS (SELECT 1 FROM configuration.warehouses WHERE branch_id = $1 AND code = $3)`,
            [branch.id, loc.legacy.warehouse, stall.code]
          );
        }
        await upsertOne(c, {
          select: `SELECT id FROM configuration.warehouses WHERE branch_id = $1 AND code = $2 LIMIT 1`,
          selectParams: [branch.id, stall.code],
          update: `UPDATE configuration.warehouses SET name = $2, is_default = $3, is_active = true, updated_at = NOW() WHERE id = $1`,
          updateParams: [stall.name, i === 0],
          insert: `INSERT INTO configuration.warehouses (branch_id, code, name, is_default, is_active)
                   VALUES ($1, $2, $3, $4, true) RETURNING id`,
          insertParams: [branch.id, stall.code, stall.name, i === 0],
        });
        stallCount += 1;
      }

      // Trigger cabang baru membuat stall "Main Storage" (MAIN) otomatis. Toko Ballooney
      // hanya memakai stall di daftar, jadi sisanya dinonaktifkan & bukan default.
      await c.query(
        `UPDATE configuration.warehouses SET is_active = false, is_default = false, updated_at = NOW()
         WHERE branch_id = $1 AND NOT (code = ANY($2::text[])) AND (is_active OR is_default)`,
        [branch.id, loc.stalls.map((st) => st.code)]
      );

      // Trigger sync_branch_to_brands mencerminkan cabang ke item.brands (id sama)
      // dengan industri default F&B — Ballooney adalah retail.
      await c.query(`UPDATE item.brands SET industry = 'Retail' WHERE id = $1`, [branch.id]);

      // Header struk per cabang (berlaku untuk semua stall di cabang itu).
      const header = [loc.name, loc.address];
      await upsertOne(c, {
        select: `SELECT id FROM pos.pos_receipt_settings WHERE branch_id = $1 AND warehouse_id IS NULL LIMIT 1`,
        selectParams: [branch.id],
        update: `UPDATE pos.pos_receipt_settings SET header_lines = $2::jsonb, footer_lines = $3::jsonb,
                   show_stall_name = false, is_active = true, updated_at = NOW() WHERE id = $1`,
        updateParams: [JSON.stringify(header), JSON.stringify(RECEIPT_FOOTER)],
        insert: `INSERT INTO pos.pos_receipt_settings (branch_id, header_lines, footer_lines, show_stall_name, is_active)
                 VALUES ($1, $2::jsonb, $3::jsonb, false, true) RETURNING id`,
        insertParams: [branch.id, JSON.stringify(header), JSON.stringify(RECEIPT_FOOTER)],
      });

      const label = { hq: "HQ", flagship: "Flagship", mall: "Mall" }[loc.kind];
      console.log(`  ✓ [${label.padEnd(8)}] ${loc.code.padEnd(20)} ${loc.name} — ${loc.city}`);
    }

    // Cabang Ballooney lain yang tidak ada di daftar dinonaktifkan (bukan dihapus).
    const off = await c.query(
      `UPDATE configuration.branches SET is_active = false, updated_at = NOW()
       WHERE company_id = $1 AND is_active AND NOT (code = ANY($2::text[]))`,
      [company.id, LOCATIONS.map((l) => l.code)]
    );
    if (off.rowCount) console.log(`  Dinonaktifkan: ${off.rowCount} cabang yang tidak ada di daftar.`);

    await c.query("COMMIT");
    const stores = LOCATIONS.filter((l) => l.kind !== "hq").length;
    console.log(`\nSelesai: 1 holding, 1 company, ${LOCATIONS.length} cabang (${stores} toko), ${stallCount} stall.`);
  } catch (err) {
    await c.query("ROLLBACK").catch(() => {});
    console.error("Gagal:", err.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}

module.exports = { LOCATIONS };

if (require.main === module) main();
