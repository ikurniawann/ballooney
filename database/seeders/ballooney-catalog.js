#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- seeder Node CommonJS, sama seperti seeder lain */
/**
 * Seeder: katalog Ballooney (ballooney.co.id) — balon foil & latex, hand bouquet,
 * rangkaian bunga, balloon gift & box, konfigurasi balon, balloon art, party
 * pack, paket dekorasi, hadiah tema, koleksi musiman.
 *
 * Data dari database/seeders/data/ballooney-catalog.json, dibangkitkan oleh
 * data/build_ballooney_catalog.py dari katalog publik ballooney.co.id
 * (WooCommerce Store API) 2026-10-04: nama, harga jual, kategori, dan foto =
 * data situs. HPP, stok awal, barcode internal (prefiks GS1 in-store 200),
 * varian ber-stok, dan harga opsi personalisasi = ASUMSI demo (di situs semua
 * opsi personalisasi tampil "Rp" tanpa nilai).
 *
 * Dua mode produk (titik berat Ballooney = personalisasi):
 *   - mode "stock"  — barang siap jual (Balon Foil, Balon Latex): fitur
 *     merchandise POS (EPIC-039), product_kind = 'merchandise',
 *     inventory_tracking = true, varian ber-SKU (Warna / Huruf / Angka / Motif)
 *     dengan barcode & stok sendiri di pos.pos_product_skus. Produk tanpa varian
 *     tetap diberi satu SKU "Standar" supaya bisa di-scan; stok dipegang SKU.
 *     Opsi personalisasi (isi helium, pemberat) dipilih kasir SETELAH varian
 *     (EPIC-054).
 *   - mode "custom" — dibuat sesuai pesanan (buket, rangkaian bunga, gift box,
 *     konfigurasi balon, dekorasi): product_kind = 'regular', tanpa stok;
 *     varian harga bertingkat di pos.pos_product_variants (Ukuran: Standar /
 *     Besar / Jumbo untuk buket & rangkaian bunga) dan grup personalisasi
 *     berharga di pos.pos_modifier_groups/pos_modifiers (warna balon, boneka,
 *     wrapping, pita, kartu ucapan, tema warna, tulisan custom, pengiriman &
 *     pemasangan, …), ditautkan per produk lewat pos.pos_product_modifiers.
 *     Teks bebas (isi kartu ucapan, nama, tanggal acara) masuk catatan item.
 *
 * Tabel yang diisi:
 *   - item.product_categories + item.products   (katalog, laporan, stall)
 *   - pos.pos_categories + pos.pos_products     (kasir & toko online),
 *     source_product_id → item.products.id
 *   - pos.pos_modifier_groups / pos_modifiers / pos_product_modifiers (personalisasi)
 *   - pos.pos_product_variants                  (ukuran produk custom)
 *   - pos.pos_product_skus                      (varian ber-stok produk siap jual)
 *   - pos.pos_inventory_settings                stok tidak boleh minus, ambang stok menipis
 *   - pos.pos_product_images                    foto produk (public/products/ballooney)
 *   - inventory.finished_goods_inventory        stok awal produk siap jual (= SUM varian)
 *   - pos.pos_sku_stock_locations (+movements)  stok per lokasi (struktur bisnis
 *     ballooney-business-structure.js; saat ini satu lokasi Gading Serpong).
 *     Prasyarat: ballooney-structure.
 *
 * Idempotent & "replace": upsert per SKU; produk/kategori/opsi yang tidak ada di
 * katalog dinonaktifkan (bukan dihapus) supaya transaksi lama tetap utuh.
 *
 * Usage:
 *   node database/seeders/ballooney-catalog.js
 *   npm run db:seed:ballooney-catalog
 */

const fs = require("fs");
const path = require("path");
const { runSeeder, firstStall } = require("./lib/ballooney-demo");

const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "ballooney-catalog.json"), "utf-8"));

/** Satuan retail & florist. Satuan khas F&B (cup, porsi, sendok, …) dinonaktifkan. */
const UNITS = [
  ["PCS", "Pieces", "KECIL", "Satuan barang jadi"],
  ["SET", "Set", "KECIL", "Paket/bundle beberapa barang"],
  ["BOX", "Box", "BESAR", "Kemasan box"],
  ["PACK", "Pack", "BESAR", "Kemasan pack"],
  ["LUSIN", "Lusin", "BESAR", "12 pcs — satuan beli grosir"],
  ["CTN", "Karton", "BESAR", "Karton kiriman supplier"],
  ["ROLL", "Roll", "BESAR", "Gulungan (lakban, bubble wrap, label)"],
  ["LBR", "Lembar", "KECIL", "Lembaran (sticker, kertas)"],
  ["ML", "Mililiter", "KECIL", "Volume cairan (lem, pewarna bunga)"],
  ["BTL", "Botol", "KECIL", "Botol cairan"],
  ["IKAT", "Ikat", "KECIL", "Ikatan bunga segar dari supplier"],
  ["TBG", "Tabung", "BESAR", "Tabung gas helium"],
];
const FNB_UNITS = ["CUP", "PORSI", "SLICE", "TBSP", "TSP", "BUTIR", "GAL", "SACK", "TRAY", "BKS", "SACHET", "OZ"];

const LOW_STOCK_THRESHOLD = 3;

/** Hash stabil — sebaran stok per lokasi sama persis tiap seeder dijalankan. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Stok awal varian per jenis lokasi (hq | flagship | mall). */
function seedQty(sku, location) {
  const h = hash(`${sku}@${location.code}`);
  if (location.kind === "hq") return 8 + (h % 25);
  if (location.kind === "flagship") return 3 + (h % 10);
  return h % 10 === 0 ? 0 : 1 + (h % 7);
}

/** Lokasi stok aktif = stall pertama tiap cabang di struktur bisnis. */
async function loadStockLocations(c, companyId) {
  const { LOCATIONS } = require("./ballooney-business-structure");
  const { rows } = await c.query(
    `SELECT b.code AS branch_code, w.id, w.code, w.name
     FROM configuration.branches b
     JOIN configuration.warehouses w ON w.branch_id = b.id AND w.is_active
     WHERE b.company_id = $1 AND b.is_active`,
    [companyId]
  );
  const out = [];
  for (const loc of LOCATIONS) {
    const stall = rows.find((r) => r.branch_code === loc.code && r.code === loc.stalls[0].code);
    if (stall) out.push({ id: stall.id, code: loc.code, name: stall.name, kind: loc.kind });
  }
  if (!out.some((l) => l.kind === "hq")) {
    throw new Error("Lokasi HQ belum ada — jalankan dulu: npm run db:seed:ballooney-structure");
  }
  return out;
}

/**
 * Jadikan produk multi-toko dan tulis stok awal per lokasi. Ditulis langsung
 * (bukan lewat koreksi) supaya kartu stok berisi satu baris "Stok awal" per
 * lokasi; dijalankan ulang → stok & kartu stok seed diganti, bukan ditumpuk.
 */
async function seedStoreStock(c, posId, skuIds, skuCodes, locations) {
  await c.query(`UPDATE pos.pos_products SET store_scope = 'all', updated_at = NOW() WHERE id = $1`, [posId]);
  let total = 0;
  await c.query(`SELECT set_config('pos.sku_stock_sync', 'on', true)`);
  await c.query(`DELETE FROM pos.pos_sku_stock_locations WHERE sku_id = ANY($1::uuid[])`, [skuIds]);
  await c.query(
    `DELETE FROM pos.pos_sku_stock_movements WHERE sku_id = ANY($1::uuid[]) AND reference_type = 'seed'`,
    [skuIds]
  );
  for (const [i, skuId] of skuIds.entries()) {
    for (const loc of locations) {
      const qty = seedQty(skuCodes[i], loc);
      total += qty;
      await c.query(
        `INSERT INTO pos.pos_sku_stock_locations (sku_id, warehouse_id, stock_quantity, min_stock)
         VALUES ($1, $2, $3, $4)`,
        [skuId, loc.id, qty, loc.kind === "hq" ? 5 : 2]
      );
      await c.query(
        `INSERT INTO pos.pos_sku_stock_movements
           (sku_id, warehouse_id, movement_type, qty_change, qty_after, reference_type, note)
         VALUES ($1, $2, 'initial', $3, $3, 'seed', 'Stok awal (seeder)')`,
        [skuId, loc.id, qty]
      );
    }
    await c.query(`SELECT pos.pos_sync_sku_total($1)`, [skuId]);
  }
  return total;
}

async function upsertUnits(c, companyId) {
  for (const [kode, nama, tipe, deskripsi] of UNITS) {
    const { rows } = await c.query(
      `SELECT id FROM item.units WHERE upper(kode) = $1 AND company_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [kode, companyId]
    );
    if (rows[0]) {
      await c.query(
        `UPDATE item.units SET nama = $2, tipe = $3, deskripsi = $4, is_active = true, updated_at = NOW() WHERE id = $1`,
        [rows[0].id, nama, tipe, deskripsi]
      );
    } else {
      await c.query(
        `INSERT INTO item.units (kode, nama, tipe, deskripsi, company_id, is_active) VALUES ($1,$2,$3,$4,$5,true)`,
        [kode, nama, tipe, deskripsi, companyId]
      );
    }
  }
  const off = await c.query(
    `UPDATE item.units SET is_active = false, updated_at = NOW()
     WHERE company_id = $1 AND upper(kode) = ANY($2::text[]) AND is_active`,
    [companyId, FNB_UNITS]
  );
  const { rows } = await c.query(`SELECT id FROM item.units WHERE upper(kode) = 'PCS' AND company_id = $1 LIMIT 1`, [companyId]);
  return { pcsId: rows[0].id, fnbOff: off.rowCount };
}

async function upsertBrand(c) {
  const { rows } = await c.query(`SELECT id FROM item.brands WHERE lower(name) = 'ballooney' LIMIT 1`);
  if (rows[0]) {
    await c.query(`UPDATE item.brands SET industry = 'Retail', logo_url = '/logos/ballooney-mark.png', is_active = true WHERE id = $1`, [rows[0].id]);
    return rows[0].id;
  }
  const ins = await c.query(
    `INSERT INTO item.brands (name, industry, logo_url, is_active) VALUES ('Ballooney', 'Retail', '/logos/ballooney-mark.png', true) RETURNING id`
  );
  return ins.rows[0].id;
}

/** pos_categories tidak punya kunci unik — cocokkan per nama. */
async function upsertPosCategory(c, name, order) {
  const { rows } = await c.query(`SELECT id FROM pos.pos_categories WHERE lower(name) = lower($1) ORDER BY created_at LIMIT 1`, [name]);
  if (rows[0]) {
    await c.query(
      `UPDATE pos.pos_categories SET name = $2, display_order = $3, is_active = true, parent_id = NULL, updated_at = NOW() WHERE id = $1`,
      [rows[0].id, name, order]
    );
    return rows[0].id;
  }
  const ins = await c.query(`INSERT INTO pos.pos_categories (name, display_order, is_active) VALUES ($1, $2, true) RETURNING id`, [name, order]);
  return ins.rows[0].id;
}

const UPSERT_ITEM_PRODUCT_SQL = `
  INSERT INTO item.products
    (kode, nama, deskripsi, kategori, satuan_id, harga_jual, harga_modal, station,
     production_output_type, warehouse_id, company_id, branch_id, is_active)
  VALUES ($1, $2, $3, $4, $5, $6, $7, 'merchandise', 'FINISHED_GOOD', $8, $9, $10, true)
  ON CONFLICT (
    COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    warehouse_id,
    kode
  ) WHERE deleted_at IS NULL
  DO UPDATE SET
    nama = EXCLUDED.nama, deskripsi = EXCLUDED.deskripsi, kategori = EXCLUDED.kategori,
    satuan_id = EXCLUDED.satuan_id, harga_jual = EXCLUDED.harga_jual, harga_modal = EXCLUDED.harga_modal,
    station = EXCLUDED.station, is_active = true, deleted_at = NULL, updated_at = NOW()
  RETURNING id
`;

const UPSERT_POS_PRODUCT_SQL = `
  INSERT INTO pos.pos_products
    (sku, name, description, long_description, category_id, base_price, cost_price, station,
     product_kind, inventory_tracking, inventory_quantity, inventory_min_stock,
     source_product_id, image_url, weight_gram, sales_channels, is_active, is_available)
  VALUES ($1, $2, $3, $4, $5, $6, $7, 'merchandise', $13, $14, $8, $9, $10, $11, $12,
          ARRAY['pos']::text[], true, true)
  ON CONFLICT (sku) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, long_description = EXCLUDED.long_description,
    category_id = EXCLUDED.category_id, base_price = EXCLUDED.base_price, cost_price = EXCLUDED.cost_price,
    station = EXCLUDED.station, product_kind = EXCLUDED.product_kind, inventory_tracking = EXCLUDED.inventory_tracking,
    inventory_quantity = EXCLUDED.inventory_quantity, inventory_min_stock = EXCLUDED.inventory_min_stock,
    source_product_id = EXCLUDED.source_product_id, image_url = EXCLUDED.image_url,
    weight_gram = EXCLUDED.weight_gram, sales_channels = EXCLUDED.sales_channels,
    is_active = true, is_available = true, updated_at = NOW()
  RETURNING id
`;

async function upsertSku(c, productId, v) {
  const { rows } = await c.query(`SELECT id FROM pos.pos_product_skus WHERE lower(sku) = lower($1) LIMIT 1`, [v.sku]);
  const params = [productId, v.sku, v.name, JSON.stringify(v.options), v.barcode, v.price_override ?? null, v.stock];
  if (rows[0]) {
    await c.query(
      `UPDATE pos.pos_product_skus
       SET product_id = $2, sku = $3, name = $4, options = $5::jsonb, barcode = $6, price_override = $7,
           stock_quantity = $8, is_active = true, updated_at = NOW()
       WHERE id = $1`,
      [rows[0].id, ...params]
    );
    return rows[0].id;
  }
  const ins = await c.query(
    `INSERT INTO pos.pos_product_skus (product_id, sku, name, options, barcode, price_override, stock_quantity, is_active)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, true) RETURNING id`,
    params
  );
  return ins.rows[0].id;
}

/**
 * Grup personalisasi bersama (satu baris per grup, dipakai banyak produk).
 * pos_modifier_groups tidak punya kunci unik → cocokkan per nama (nama grup di
 * katalog dibuat unik). Opsi di-upsert per (grup, nama); opsi yang hilang dari
 * katalog dinonaktifkan — riwayat order menyimpan NAMA opsi, bukan id.
 */
async function upsertModifierGroups(c) {
  const idByCode = new Map();
  let optionCount = 0;
  for (const [i, g] of CATALOG.modifier_groups.entries()) {
    const { rows } = await c.query(
      `SELECT id FROM pos.pos_modifier_groups WHERE lower(name) = lower($1) ORDER BY created_at LIMIT 1`,
      [g.name]
    );
    let groupId = rows[0]?.id;
    if (groupId) {
      await c.query(
        `UPDATE pos.pos_modifier_groups SET name = $2, min_selection = $3, max_selection = $4,
           display_order = $5, is_active = true WHERE id = $1`,
        [groupId, g.name, g.min, g.max, i + 1]
      );
    } else {
      const ins = await c.query(
        `INSERT INTO pos.pos_modifier_groups (name, min_selection, max_selection, display_order, is_active)
         VALUES ($1, $2, $3, $4, true) RETURNING id`,
        [g.name, g.min, g.max, i + 1]
      );
      groupId = ins.rows[0].id;
    }
    const keep = [];
    for (const [j, opt] of g.options.entries()) {
      const found = await c.query(
        `SELECT id FROM pos.pos_modifiers WHERE group_id = $1 AND lower(name) = lower($2) LIMIT 1`,
        [groupId, opt.name]
      );
      if (found.rows[0]) {
        await c.query(
          `UPDATE pos.pos_modifiers SET name = $2, price_adjustment = $3, display_order = $4, is_active = true WHERE id = $1`,
          [found.rows[0].id, opt.name, opt.price_adjustment, j + 1]
        );
        keep.push(found.rows[0].id);
      } else {
        const ins = await c.query(
          `INSERT INTO pos.pos_modifiers (group_id, name, price_adjustment, display_order, is_active)
           VALUES ($1, $2, $3, $4, true) RETURNING id`,
          [groupId, opt.name, opt.price_adjustment, j + 1]
        );
        keep.push(ins.rows[0].id);
      }
      optionCount += 1;
    }
    await c.query(
      `UPDATE pos.pos_modifiers SET is_active = false WHERE group_id = $1 AND NOT (id = ANY($2::uuid[]))`,
      [groupId, keep]
    );
    idByCode.set(g.code, groupId);
  }
  const off = await c.query(
    `UPDATE pos.pos_modifier_groups SET is_active = false WHERE is_active AND NOT (id = ANY($1::uuid[]))`,
    [[...idByCode.values()]]
  );
  return { idByCode, optionCount, groupsOff: off.rowCount };
}

/** Tautan produk → grup personalisasi & varian ukuran ditulis ulang tiap seeder jalan. */
async function syncPersonalization(c, posId, p, groupIdByCode) {
  await c.query(`DELETE FROM pos.pos_product_modifiers WHERE product_id = $1`, [posId]);
  for (const code of p.modifier_groups) {
    const groupId = groupIdByCode.get(code);
    if (!groupId) throw new Error(`Grup personalisasi ${code} tidak ada di katalog (${p.sku})`);
    await c.query(
      `INSERT INTO pos.pos_product_modifiers (product_id, modifier_group_id) VALUES ($1, $2)
       ON CONFLICT (product_id, modifier_group_id) DO NOTHING`,
      [posId, groupId]
    );
  }
  await c.query(`DELETE FROM pos.pos_product_variants WHERE product_id = $1`, [posId]);
  for (const [i, v] of p.product_variants.entries()) {
    await c.query(
      `INSERT INTO pos.pos_product_variants (product_id, name, group_name, price_adjustment, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [posId, v.name, v.group, v.price_adjustment, i + 1]
    );
  }
}

runSeeder("Seeding katalog Ballooney", async (c, scope) => {
  const stall = await firstStall(c, scope.branch_id);
  if (!stall) throw new Error("Belum ada stall/gudang aktif untuk cabang ini.");
  console.log(`  stall: ${stall.name}`);

  const { pcsId, fnbOff } = await upsertUnits(c, scope.company_id);
  console.log(`  ✓ satuan retail ${UNITS.length} (satuan F&B dinonaktifkan: ${fnbOff})`);
  await upsertBrand(c);
  console.log("  ✓ brand Ballooney");

  const { idByCode: groupIdByCode, optionCount, groupsOff } = await upsertModifierGroups(c);
  console.log(`  ✓ grup personalisasi ${groupIdByCode.size} (${optionCount} opsi; dinonaktifkan ${groupsOff})`);

  const categoryNameByCode = new Map();
  const posCategoryByCode = new Map();
  for (const [i, cat] of CATALOG.categories.entries()) {
    await c.query(
      `INSERT INTO item.product_categories (code, nama, deskripsi, company_id, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (company_id, code) WHERE deleted_at IS NULL AND company_id IS NOT NULL
       DO UPDATE SET nama = EXCLUDED.nama, deskripsi = EXCLUDED.deskripsi, is_active = true,
                     deleted_at = NULL, updated_at = NOW()`,
      [cat.code, cat.name, cat.description, scope.company_id]
    );
    categoryNameByCode.set(cat.code, cat.name);
    posCategoryByCode.set(cat.code, await upsertPosCategory(c, cat.name, i + 1));
  }
  console.log(`  ✓ kategori ${CATALOG.categories.length}`);

  const locations = await loadStockLocations(c, scope.company_id);
  console.log(`  ✓ lokasi stok: ${locations.map((l) => l.name).join(", ")}`);

  // Stok ditulis ulang dari nol → transfer demo (ballooney-demo-store-transfers.js)
  // beserta kartu stoknya ikut dibuang; seeder transfer membuatnya lagi.
  await c.query(
    `DELETE FROM pos.pos_sku_stock_movements WHERE reference_type = 'stock_transfer'
       AND reference_id IN (SELECT id FROM pos.pos_stock_transfers WHERE notes LIKE 'DEMO%')`
  );
  await c.query(`DELETE FROM pos.pos_stock_transfers WHERE notes LIKE 'DEMO%'`);

  const productSkus = [];
  const variantSkus = [];
  let variantCount = 0;
  let totalUnits = 0;
  let customCount = 0;
  for (const p of CATALOG.products) {
    const isStock = p.mode === "stock";
    const hasVariants = p.variants.length > 0;

    const item = await c.query(UPSERT_ITEM_PRODUCT_SQL, [
      p.sku, p.name, p.description, p.category, pcsId, p.price, p.cost,
      stall.id, scope.company_id, scope.branch_id,
    ]);
    const itemId = item.rows[0].id;

    const groupNames = p.modifier_groups.map(
      (code) => CATALOG.modifier_groups.find((g) => g.code === code)?.name
    );
    const longDescription = [
      p.description,
      p.compare_at_price ? `Harga normal Rp ${p.compare_at_price.toLocaleString("id-ID")}.` : null,
      hasVariants ? `Varian: ${[...new Set(p.variants.flatMap((v) => Object.keys(v.options)))].join(", ")}.` : null,
      p.product_variants.length ? `Ukuran: ${p.product_variants.map((v) => v.name).join(" / ")}.` : null,
      isStock ? null : "Dibuat sesuai pesanan.",
      groupNames.length ? `Personalisasi: ${groupNames.join(", ")}.` : null,
      p.themes.length ? `Tema: ${p.themes.join(", ")}.` : null,
    ].filter(Boolean).join(" ");
    const pos = await c.query(UPSERT_POS_PRODUCT_SQL, [
      p.sku, p.name, p.description, longDescription, posCategoryByCode.get(p.category),
      p.price, p.cost, 0, isStock ? LOW_STOCK_THRESHOLD : 0, itemId, p.image, p.weight_gram,
      isStock ? "merchandise" : "regular", isStock,
    ]);
    const posId = pos.rows[0].id;

    await c.query(
      `INSERT INTO pos.pos_inventory_settings (product_id, allow_negative_stock, low_stock_threshold)
       VALUES ($1, false, $2)
       ON CONFLICT (product_id) DO UPDATE SET allow_negative_stock = false, low_stock_threshold = EXCLUDED.low_stock_threshold, updated_at = NOW()`,
      [posId, LOW_STOCK_THRESHOLD]
    );

    await c.query(`DELETE FROM pos.pos_product_images WHERE product_id = $1`, [posId]);
    if (p.image) {
      await c.query(`INSERT INTO pos.pos_product_images (product_id, url, display_order) VALUES ($1, $2, 0)`, [posId, p.image]);
    }

    await syncPersonalization(c, posId, p, groupIdByCode);

    let stock = 0;
    if (isStock) {
      const variants = hasVariants
        ? p.variants
        : [{ sku: `${p.sku}-STD`, name: "Standar", options: {}, barcode: p.barcode }];
      // Upsert varian tanpa memicu routing stok multi-toko (stok ditulis ulang di bawah).
      await c.query(`SELECT set_config('pos.sku_stock_sync', 'on', true)`);
      const skuIds = [];
      for (const v of variants) {
        skuIds.push(await upsertSku(c, posId, { ...v, stock: 0 }));
        variantSkus.push(v.sku.toLowerCase());
        variantCount += 1;
      }
      stock = await seedStoreStock(c, posId, skuIds, variants.map((v) => v.sku), locations);
      totalUnits += stock;
      await c.query(
        `INSERT INTO inventory.finished_goods_inventory (product_id, qty_available, unit_cost, last_movement_at, is_active)
         VALUES ($1, $2, $3, NOW(), true)
         ON CONFLICT (product_id) DO UPDATE SET qty_available = EXCLUDED.qty_available, unit_cost = EXCLUDED.unit_cost,
           last_movement_at = NOW(), is_active = true, updated_at = NOW()`,
        [itemId, stock, p.cost]
      );
    } else {
      customCount += 1;
    }

    productSkus.push(p.sku);
    const detail = isStock
      ? `${hasVariants ? `${String(p.variants.length).padStart(2)} varian` : "tunggal  "}  stok ${stock}`
      : `custom   ${p.modifier_groups.length} grup personalisasi${p.product_variants.length ? " + ukuran" : ""}`;
    console.log(
      `  ✓ ${p.sku.padEnd(11)} ${p.name.slice(0, 40).padEnd(40)} Rp ${p.price.toLocaleString("id-ID").padStart(9)}  ${detail}`
    );
  }

  // "Replace": yang tidak ada di katalog dinonaktifkan, bukan dihapus.
  const offSku = await c.query(
    `UPDATE pos.pos_product_skus SET is_active = false, updated_at = NOW()
     WHERE is_active AND NOT (lower(sku) = ANY($1::text[]))`,
    [variantSkus]
  );
  const offPos = await c.query(
    `UPDATE pos.pos_products SET is_active = false, is_available = false, updated_at = NOW()
     WHERE is_active AND product_kind <> 'gift_card' AND NOT (sku = ANY($1::text[]))`,
    [productSkus]
  );
  const offItem = await c.query(
    `UPDATE item.products SET is_active = false, updated_at = NOW()
     WHERE is_active AND company_id = $1 AND production_output_type = 'FINISHED_GOOD' AND NOT (kode = ANY($2::text[]))`,
    [scope.company_id, productSkus]
  );
  const offCat = await c.query(
    `UPDATE item.product_categories SET is_active = false, updated_at = NOW()
     WHERE is_active AND company_id = $1 AND NOT (code = ANY($2::text[]))`,
    [scope.company_id, CATALOG.categories.map((cat) => cat.code)]
  );
  const offPosCat = await c.query(
    `UPDATE pos.pos_categories SET is_active = false, updated_at = NOW()
     WHERE is_active AND NOT (id = ANY($1::uuid[]))`,
    [[...posCategoryByCode.values()]]
  );
  console.log(
    `  Dinonaktifkan (tidak ada di katalog): ${offPos.rowCount} produk POS, ${offSku.rowCount} varian, ` +
      `${offItem.rowCount} produk katalog, ${offCat.rowCount + offPosCat.rowCount} kategori.`
  );

  return {
    kategori: CATALOG.categories.length,
    produk: CATALOG.products.length,
    "produk custom (made-to-order)": customCount,
    "grup personalisasi": groupIdByCode.size,
    "SKU/varian ber-stok": variantCount,
    "lokasi": locations.length,
    "total stok semua lokasi (pcs)": totalUnits,
  };
});
