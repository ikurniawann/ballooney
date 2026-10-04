#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- seeder Node CommonJS, sama seperti seeder lain */
/**
 * Seeder: bahan & perlengkapan Ballooney — balon bahan produksi, helium, bunga
 * segar, wrapping & pita, boneka, perlengkapan dekor, kemasan, dan perlengkapan toko.
 *
 * Ballooney menjual balon foil/latex siap jual (stok), tapi sebagian besar
 * produknya dibuat sesuai pesanan di workshop Gading Serpong: buket bunga &
 * balon, balloon box, konfigurasi balon, dan paket dekorasi acara. Bahan-bahan
 * itulah yang dibeli dan distok sebagai item.raw_materials, sedangkan barang
 * dagangan jadi ada di ballooney-catalog.js (item.products + POS merchandise).
 *
 * Bentuk satu baris MATERIALS:
 *   [kode, nama, kategori, satuan_besar, satuan_kecil, konversi,
 *    stok_min, stok_max, storage_condition, deskripsi, harga_beli]
 *   - konversi  = jumlah satuan kecil dalam 1 satuan besar
 *   - stok_min/max dalam SATUAN BESAR — satuan yang ditampilkan dan dipakai
 *     menilai persediaan di v_raw_materials_stock (qty × harga_beli)
 *   - harga_beli = per SATUAN BESAR, rupiah — ASUMSI demo, bukan harga kontrak
 *   - bunga segar memakai PACK (= satu ikat dari supplier) + PCS (= tangkai)
 *     dan disimpan DINGIN (chiller bunga)
 *
 * Idempotent: upsert per kode. Prasyarat: ballooney-catalog.js (satuan retail).
 *
 * Usage:
 *   node database/seeders/ballooney-supplies.js
 *   npm run db:seed:ballooney-supplies
 */

const { runSeeder } = require("./lib/ballooney-demo");

const CATEGORIES = [
  { code: "BALON", nama: "Balon Bahan Produksi", deskripsi: "Latex, chrome, bubble/bobo, foil blank, dan balon twisting curah untuk produksi" },
  { code: "HELIUM", nama: "Helium & Perlengkapan Isi", deskripsi: "Tabung helium isi ulang, regulator, nozzle, pelapis Hi-Float" },
  { code: "BUNGA", nama: "Bunga Segar & Kering", deskripsi: "Mawar, baby's breath, tulip, hydrangea, daun filler, bunga kering" },
  { code: "WRAPPING", nama: "Wrapping & Pita", deskripsi: "Kertas wrapping per tema, kertas korea, cellophane, pita satin per warna" },
  { code: "BONEKA", nama: "Boneka & Pelengkap Gift", deskripsi: "White Bear, Graduation Bear, Love Bear, teddy, coklat pelengkap" },
  { code: "DEKOR", nama: "Perlengkapan Dekor", deskripsi: "Floral foam, lem tembak, stik & cup, pemberat, benang, lampu LED, sticker vinyl" },
  { code: "KEMASAN", nama: "Kemasan & Kartu", deskripsi: "Balloon box mika, box bunga, kartu ucapan, paper bag" },
  { code: "TOKO", nama: "Perlengkapan Toko", deskripsi: "Kertas struk, label, perlengkapan kasir" },
];

const MATERIALS = [
  // ── Balon bahan produksi (stok per PCS; dibeli per PACK dari distributor) ─
  ["BLN-RM-001", "Balon Latex 12 inci Pastel (pack isi 100)", "BALON", "PACK", "PCS", 100, 5, 30, "SUHU_RUANG", "Latex 12\" warna pastel campur untuk garland, bouquet, dan dekorasi", 85000],
  ["BLN-RM-002", "Balon Latex 12 inci Doff Warna Solid (pack isi 100)", "BALON", "PACK", "PCS", 100, 5, 30, "SUHU_RUANG", "Latex 12\" doff per warna (merah, putih, hitam, biru, dll.)", 80000],
  ["BLN-RM-003", "Balon Latex 5 inci Mini (pack isi 100)", "BALON", "PACK", "PCS", 100, 3, 20, "SUHU_RUANG", "Latex mini 5\" untuk garland organik & isian balloon box", 45000],
  ["BLN-RM-004", "Balon Latex 18 inci (pack isi 25)", "BALON", "PACK", "PCS", 25, 2, 10, "SUHU_RUANG", "Latex 18\" untuk konfigurasi balon & garland besar", 120000],
  ["BLN-RM-005", "Balon Chrome 12 inci Gold/Silver/Rose Gold (pack isi 50)", "BALON", "PACK", "PCS", 50, 3, 15, "SUHU_RUANG", "Latex chrome metalik untuk dekorasi premium", 150000],
  ["BLN-RM-006", "Balon Bobo / Bubble Transparan 24 inci (pack isi 50)", "BALON", "PACK", "PCS", 50, 2, 10, "SUHU_RUANG", "Balon bubble bening untuk balloon box & stuffed balloon", 400000],
  ["BLN-RM-007", "Balon Foil Bulat Blank 18 inci (pack isi 50)", "BALON", "PACK", "PCS", 50, 2, 8, "SUHU_RUANG", "Foil bulat polos untuk ditempel tulisan custom nama", 175000],
  ["BLN-RM-008", "Balon Twisting 260 (pack isi 100)", "BALON", "PACK", "PCS", 100, 2, 10, "SUHU_RUANG", "Balon pentil panjang untuk balloon art & twisting karakter", 95000],
  // ── Helium & perlengkapan isi (tabung disimpan tegak & diikat) ────────────
  ["BLN-RM-010", "Helium Tabung 6 m³ (isi ulang)", "HELIUM", "PCS", "PCS", 1, 1, 4, "KHUSUS", "Gas helium untuk ±600 balon latex 12\"; tabung tegak, jauh dari panas", 3200000],
  ["BLN-RM-011", "Helium Tabung 1 m³ (isi ulang)", "HELIUM", "PCS", "PCS", 1, 1, 3, "KHUSUS", "Tabung kecil untuk dibawa kru ke lokasi acara", 650000],
  ["BLN-RM-012", "Regulator & Nozzle Helium", "HELIUM", "PCS", "PCS", 1, 1, 3, "KHUSUS", "Regulator tekanan + nozzle pengisi balon latex & foil", 450000],
  ["BLN-RM-013", "Hi-Float Pelapis Balon Latex 473 ml", "HELIUM", "BTL", "ML", 473, 1, 4, "SUHU_RUANG", "Cairan pelapis agar balon latex helium melayang lebih lama", 285000],
  // ── Bunga segar & kering (PACK = 1 ikat supplier; disimpan di chiller) ────
  ["BLN-RM-020", "Mawar Merah Lokal (ikat isi 20 tangkai)", "BUNGA", "PACK", "PCS", 20, 3, 12, "DINGIN", "Mawar segar, chiller 2–5 °C, umur simpan ±5 hari", 75000],
  ["BLN-RM-021", "Mawar Pink Lokal (ikat isi 20 tangkai)", "BUNGA", "PACK", "PCS", 20, 2, 10, "DINGIN", "Mawar segar, chiller 2–5 °C, umur simpan ±5 hari", 75000],
  ["BLN-RM-022", "Mawar Putih Lokal (ikat isi 20 tangkai)", "BUNGA", "PACK", "PCS", 20, 2, 10, "DINGIN", "Mawar segar, chiller 2–5 °C, umur simpan ±5 hari", 80000],
  ["BLN-RM-023", "Baby's Breath / Gypsophila (ikat isi 10 tangkai)", "BUNGA", "PACK", "PCS", 10, 2, 8, "DINGIN", "Filler bunga putih untuk buket & rangkaian", 65000],
  ["BLN-RM-024", "Tulip Impor (ikat isi 10 tangkai)", "BUNGA", "PACK", "PCS", 10, 1, 4, "DINGIN", "Tulip impor untuk buket premium, pesan H-3", 350000],
  ["BLN-RM-025", "Hydrangea Biru/Putih (ikat isi 5 tangkai)", "BUNGA", "PACK", "PCS", 5, 1, 4, "DINGIN", "Hydrangea segar untuk flower box & dekorasi meja", 175000],
  ["BLN-RM-026", "Daun Eucalyptus (ikat isi 10 tangkai)", "BUNGA", "PACK", "PCS", 10, 1, 6, "DINGIN", "Daun filler aroma segar untuk buket", 45000],
  ["BLN-RM-027", "Pampas Grass Kering (ikat isi 10 tangkai)", "BUNGA", "PACK", "PCS", 10, 1, 5, "SUHU_RUANG", "Bunga kering untuk dekorasi boho & backdrop", 85000],
  // ── Wrapping & pita ───────────────────────────────────────────────────────
  ["BLN-RM-030", "Kertas Korea Doff Polos (pack isi 20 lbr)", "WRAPPING", "PACK", "LBR", 20, 3, 15, "SUHU_RUANG", "Kertas wrapping waterproof polos warna pastel", 55000],
  ["BLN-RM-031", "Kertas Wrapping Tema Love (pack isi 20 lbr)", "WRAPPING", "PACK", "LBR", 20, 2, 10, "SUHU_RUANG", "Motif hati untuk buket valentine & anniversary", 60000],
  ["BLN-RM-032", "Kertas Wrapping Tema Graduation (pack isi 20 lbr)", "WRAPPING", "PACK", "LBR", 20, 2, 10, "SUHU_RUANG", "Motif toga & ucapan wisuda", 60000],
  ["BLN-RM-033", "Kertas Wrapping Black & Gold (pack isi 20 lbr)", "WRAPPING", "PACK", "LBR", 20, 1, 8, "SUHU_RUANG", "Wrapping elegan untuk Black/Gold Theme", 65000],
  ["BLN-RM-034", "Cellophane Bening 60 cm", "WRAPPING", "ROLL", "LBR", 50, 2, 8, "SUHU_RUANG", "Plastik cellophane roll untuk buket & parcel", 70000],
  ["BLN-RM-035", "Pita Satin 2,5 cm Merah", "WRAPPING", "LUSIN", "ROLL", 12, 1, 5, "SUHU_RUANG", "Pita satin per warna, slop isi 12 roll @25 yard", 120000],
  ["BLN-RM-036", "Pita Satin 2,5 cm Pink", "WRAPPING", "LUSIN", "ROLL", 12, 1, 5, "SUHU_RUANG", "Pita satin per warna, slop isi 12 roll @25 yard", 120000],
  ["BLN-RM-037", "Pita Satin 2,5 cm Putih", "WRAPPING", "LUSIN", "ROLL", 12, 1, 5, "SUHU_RUANG", "Pita satin per warna, slop isi 12 roll @25 yard", 120000],
  ["BLN-RM-038", "Pita Satin 2,5 cm Gold", "WRAPPING", "LUSIN", "ROLL", 12, 1, 4, "SUHU_RUANG", "Pita satin per warna, slop isi 12 roll @25 yard", 130000],
  // ── Boneka & pelengkap gift (dibeli per LUSIN) ────────────────────────────
  ["BLN-RM-040", "Boneka White Bear 20 cm", "BONEKA", "LUSIN", "PCS", 12, 1, 5, "SUHU_RUANG", "Opsi personalisasi \"White Bear\" untuk buket & balloon box", 300000],
  ["BLN-RM-041", "Boneka Graduation Bear 20 cm", "BONEKA", "LUSIN", "PCS", 12, 1, 5, "SUHU_RUANG", "Beruang bertoga — opsi \"Graduation Bear\" musim wisuda", 360000],
  ["BLN-RM-042", "Boneka Love Bear 20 cm", "BONEKA", "LUSIN", "PCS", 12, 1, 4, "SUHU_RUANG", "Beruang bantal hati — opsi \"Love Bear\"", 330000],
  ["BLN-RM-043", "Boneka Teddy Bear 40 cm", "BONEKA", "LUSIN", "PCS", 12, 1, 3, "SUHU_RUANG", "Teddy besar untuk paket teddy & balloon", 900000],
  ["BLN-RM-044", "Coklat Ferrero Rocher T3", "BONEKA", "LUSIN", "PCS", 12, 1, 4, "SUHU_RUANG", "Tambahan \"Coklat Ferrero 3 pcs\" — cek tanggal kedaluwarsa", 300000],
  // ── Perlengkapan dekor ────────────────────────────────────────────────────
  ["BLN-RM-050", "Floral Foam Basah (box isi 20 balok)", "DEKOR", "BOX", "PCS", 20, 1, 4, "SUHU_RUANG", "Oasis untuk rangkaian bunga & standing flower", 260000],
  ["BLN-RM-051", "Lem Tembak Stik Bening (pack isi 50)", "DEKOR", "PACK", "PCS", 50, 1, 5, "SUHU_RUANG", "Isi lem tembak untuk wrapping, boneka, dan dekor", 65000],
  ["BLN-RM-052", "Stik & Cup Balon (pack isi 100 set)", "DEKOR", "PACK", "SET", 100, 2, 10, "SUHU_RUANG", "Tangkai plastik + cup untuk balon tanpa helium", 50000],
  ["BLN-RM-053", "Pemberat Balon Standar (pack isi 50)", "DEKOR", "PACK", "PCS", 50, 2, 10, "SUHU_RUANG", "Pemberat foil untuk balon helium", 75000],
  ["BLN-RM-054", "Pita Curling / Benang Balon (roll 500 m)", "DEKOR", "ROLL", "ROLL", 1, 3, 15, "SUHU_RUANG", "Tali pengikat balon helium", 25000],
  ["BLN-RM-055", "Double Tape & Glue Dots (pack isi 10 roll)", "DEKOR", "PACK", "ROLL", 10, 1, 6, "SUHU_RUANG", "Perekat garland balon ke dinding & backdrop", 90000],
  ["BLN-RM-056", "Lampu LED Fairy 2 m Baterai (lusin)", "DEKOR", "LUSIN", "PCS", 12, 1, 4, "SUHU_RUANG", "Tambahan \"Lampu LED fairy\" untuk bubble & balloon box", 180000],
  ["BLN-RM-057", "Sticker Vinyl Cutting Gold/Putih", "DEKOR", "ROLL", "LBR", 20, 1, 4, "SUHU_RUANG", "Bahan tulisan custom nama di balon bubble & foil", 350000],
  ["BLN-RM-058", "Pompa Balon Listrik Dual Nozzle", "DEKOR", "PCS", "PCS", 1, 1, 3, "SUHU_RUANG", "Pompa udara untuk latex & garland di workshop/lapangan", 375000],
  // ── Kemasan & kartu ───────────────────────────────────────────────────────
  ["BLN-RM-060", "Balloon Box Mika 40x40x40 cm", "KEMASAN", "PACK", "PCS", 10, 1, 6, "SUHU_RUANG", "Box mika bening + tulisan untuk balloon box surprise", 450000],
  ["BLN-RM-061", "Box Bunga Bulat Hitam/Putih (pack isi 10)", "KEMASAN", "PACK", "PCS", 10, 1, 5, "SUHU_RUANG", "Flower box bulat untuk rangkaian mawar", 280000],
  ["BLN-RM-062", "Kartu Ucapan Standar Ballooney (pack isi 100)", "KEMASAN", "PACK", "LBR", 100, 1, 5, "SUHU_RUANG", "Kartu ucapan gratis tiap pesanan gift", 120000],
  ["BLN-RM-063", "Kartu Premium + Amplop (pack isi 50)", "KEMASAN", "PACK", "SET", 50, 1, 4, "SUHU_RUANG", "Opsi \"Kartu premium + amplop\"", 175000],
  ["BLN-RM-064", "Paper Bag Ballooney Medium (pack isi 50)", "KEMASAN", "PACK", "PCS", 50, 2, 10, "SUHU_RUANG", "Paper bag bermerek untuk pembelian di toko", 275000],
  ["BLN-RM-065", "Plastik Jumbo Balon Helium (pack isi 50)", "KEMASAN", "PACK", "PCS", 50, 1, 6, "SUHU_RUANG", "Plastik pelindung balon helium saat diantar kurir", 120000],
  // ── Perlengkapan toko ─────────────────────────────────────────────────────
  ["BLN-RM-070", "Kertas Struk Thermal 58mm", "TOKO", "BOX", "ROLL", 50, 1, 3, "SUHU_RUANG", "Kertas struk kasir, box isi 50 roll", 220000],
  ["BLN-RM-071", "Label Thermal 100x150", "TOKO", "ROLL", "LBR", 500, 1, 6, "SUHU_RUANG", "Label alamat pengiriman kurir & ekspedisi", 85000],
];

const CATEGORY_SQL = `
  INSERT INTO item.raw_material_categories (code, nama, deskripsi, company_id, is_active)
  VALUES ($1, $2, $3, $4, true)
  ON CONFLICT (company_id, code) WHERE company_id IS NOT NULL AND deleted_at IS NULL DO UPDATE
    SET nama = EXCLUDED.nama, deskripsi = EXCLUDED.deskripsi, is_active = true,
        deleted_at = NULL, updated_at = NOW()
`;

const MATERIAL_SQL = `
  INSERT INTO item.raw_materials
    (kode, nama, kategori, deskripsi, satuan_besar_id, satuan_kecil_id, konversi_factor,
     stok_minimum, stok_maximum, storage_condition, harga_beli, material_type,
     company_id, branch_id, is_active)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PURCHASED', $12, $13, true)
  ON CONFLICT (
    COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    kode
  ) WHERE deleted_at IS NULL
  DO UPDATE SET
    nama = EXCLUDED.nama, kategori = EXCLUDED.kategori, deskripsi = EXCLUDED.deskripsi,
    satuan_besar_id = EXCLUDED.satuan_besar_id, satuan_kecil_id = EXCLUDED.satuan_kecil_id,
    konversi_factor = EXCLUDED.konversi_factor, stok_minimum = EXCLUDED.stok_minimum,
    stok_maximum = EXCLUDED.stok_maximum, storage_condition = EXCLUDED.storage_condition,
    harga_beli = EXCLUDED.harga_beli, is_active = true, deleted_at = NULL, updated_at = NOW()
`;

runSeeder("Seeding bahan & perlengkapan Ballooney", async (c, scope) => {
  const { rows: unitRows } = await c.query(
    `SELECT id, upper(kode) AS kode FROM item.units WHERE company_id = $1 AND deleted_at IS NULL AND is_active`,
    [scope.company_id]
  );
  const unitMap = new Map(unitRows.map((r) => [r.kode, r.id]));
  const uid = (code) => {
    const id = unitMap.get(code);
    if (!id) throw new Error(`Satuan "${code}" tidak ditemukan. Jalankan dulu: npm run db:seed:ballooney-catalog`);
    return id;
  };

  for (const cat of CATEGORIES) {
    await c.query(CATEGORY_SQL, [cat.code, cat.nama, cat.deskripsi, scope.company_id]);
  }
  console.log(`  ✓ kategori bahan ${CATEGORIES.length}`);

  for (const [kode, nama, kategori, besar, kecil, konv, min, max, storage, deskripsi, harga] of MATERIALS) {
    await c.query(MATERIAL_SQL, [
      kode, nama, kategori, deskripsi, uid(besar), uid(kecil), konv,
      min, max, storage, harga, scope.company_id, scope.branch_id,
    ]);
    console.log(`  ✓ ${kode} — ${nama}`);
  }

  return { kategori: CATEGORIES.length, "bahan & perlengkapan": MATERIALS.length };
});
