#!/usr/bin/env node
/**
 * Seeder demo Procurement Ballooney: supplier balon, helium, bunga, florist
 * supply, boneka, dan printing; purchase request; purchase order.
 *
 * Dua jalur pembelian:
 *   - module_type 'product'      : restock barang dagangan siap jual (balon foil
 *                                  huruf/angka/bintang/love, balon latex & chrome)
 *                                  — hanya produk mode "stock" di katalog
 *   - module_type 'raw_material' : bahan workshop (balon curah, helium, bunga
 *                                  segar, wrapping & pita, boneka) dan kemasan
 * Setiap PR/PO berisi baris item yang menunjuk produk/bahan dari
 * ballooney-catalog.js & ballooney-supplies.js, sehingga total dokumen = jumlah baris.
 * Harga beli = HPP katalog (ASUMSI demo).
 *
 * Idempotent: supplier upsert per kode; PR/PO dikenali lewat nomor dokumen
 * ber-prefix DEMO- dan baris itemnya ditulis ulang tiap jalan.
 * Prasyarat: ballooney-catalog, ballooney-supplies, ballooney-hris.
 *
 * Usage:
 *   node database/seeders/ballooney-demo-procurement.js
 *   npm run db:seed:ballooney-procurement
 */

const { dayFrom, runSeeder, anyAdmin } = require("./lib/ballooney-demo");

/** [kode, nama, pic, telepon, kota, kategori, catatan, termin] — nama & kontak fiktif */
const SUPPLIERS = [
  ["SUP-BLN-001", "PT Balon Warna Nusantara", "Hendra Wijaya", "081122334455", "Jakarta Barat", "balon", "Importir & distributor balon latex, chrome, bubble, dan foil", "NET 30"],
  ["SUP-BLN-002", "CV Gas Helium Mandiri", "Andi Prakoso", "081233445566", "Kab. Tangerang", "helium", "Isi ulang & sewa tabung helium, regulator; antar ke Gading Serpong", "NET 7"],
  ["SUP-BLN-003", "UD Kebun Bunga Cipanas", "Dewi Puspita", "081344556677", "Kab. Cianjur", "bunga", "Mawar lokal & filler segar, kirim 3x seminggu", "NET 7"],
  ["SUP-BLN-004", "Kios Bunga Sumber Melati (Rawa Belong)", "Siti Aminah", "081455667788", "Jakarta Barat", "bunga", "Bunga impor: tulip, hydrangea, eucalyptus; ambil di pasar", "COD"],
  ["SUP-BLN-005", "CV Florist Supply Indonesia", "Lina Mardiana", "081566778899", "Jakarta Barat", "florist supply", "Kertas wrapping, cellophane, pita satin, floral foam, box bunga", "NET 14"],
  ["SUP-BLN-006", "PT Boneka Ceria Sejahtera", "Rahmat Iskandar", "081677889900", "Kab. Bogor", "boneka", "Produsen boneka bear custom (white, graduation, love bear)", "NET 30"],
  ["SUP-BLN-007", "CV Cetak Akrilik Serpong", "Yuliani Sari", "081788990011", "Tangerang Selatan", "printing", "Signage akrilik, neon box, banner backdrop, sticker vinyl cutting", "NET 14"],
];

/**
 * Item: ["P", sku_produk, qty] = barang dagangan (mode stock); ["R", kode_bahan, qty] = bahan (qty dalam satuan besar).
 * [nomor, prioritas, status, modul, catatan, hari_dibutuhkan, items]
 */
const PURCHASE_REQUESTS = [
  ["DEMO-PR-2601", "high", "approved", "product", "Restock balon foil huruf & angka jelang musim wisuda", 5,
    [["P", "BLN-FB-002", 200], ["P", "BLN-FB-003", 120], ["P", "BLN-FB-004", 40]]],
  ["DEMO-PR-2602", "medium", "pending_head", "raw_material", "Balon latex, chrome & bubble untuk produksi balloon box 2 minggu", 7,
    [["R", "BLN-RM-001", 10], ["R", "BLN-RM-003", 6], ["R", "BLN-RM-005", 4], ["R", "BLN-RM-006", 4]]],
  ["DEMO-PR-2603", "urgent", "pending_finance", "raw_material", "Isi ulang helium — dua dekorasi grand opening akhir pekan", 2,
    [["R", "BLN-RM-010", 2], ["R", "BLN-RM-011", 2]]],
  ["DEMO-PR-2604", "low", "draft", "product", "Usulan stok Jumbo Star & Heart Foil untuk Valentine", 21,
    [["P", "BLN-FB-008", 10], ["P", "BLN-FB-006", 50]]],
];

/** [nomor, supplier_kode, status, modul, catatan, hari_po, hari_kirim, items] */
const PURCHASE_ORDERS = [
  ["DEMO-PO-2601", "SUP-BLN-001", "approved", "product", "Restock balon foil huruf & angka 40/80 cm", -6, 3,
    [["P", "BLN-FB-002", 200], ["P", "BLN-FB-003", 120], ["P", "BLN-FB-004", 40]]],
  ["DEMO-PO-2602", "SUP-BLN-001", "sent", "product", "Balon latex 12 inci & chrome siap jual", -3, 2,
    [["P", "BLN-LX-002", 300], ["P", "BLN-LX-003", 150]]],
  ["DEMO-PO-2603", "SUP-BLN-002", "approved", "raw_material", "Isi ulang helium tabung 6 m³ & 1 m³", -2, 1,
    [["R", "BLN-RM-010", 2], ["R", "BLN-RM-011", 2]]],
  ["DEMO-PO-2604", "SUP-BLN-005", "draft", "raw_material", "Wrapping, pita satin, cellophane, floral foam", 0, 7,
    [["R", "BLN-RM-030", 5], ["R", "BLN-RM-031", 3], ["R", "BLN-RM-034", 3], ["R", "BLN-RM-035", 2], ["R", "BLN-RM-036", 2], ["R", "BLN-RM-050", 2]]],
  ["DEMO-PO-2605", "SUP-BLN-006", "received", "raw_material", "Boneka bear batch musim wisuda", -20, -12,
    [["R", "BLN-RM-040", 3], ["R", "BLN-RM-041", 4], ["R", "BLN-RM-042", 2]]],
];

runSeeder("Seeding demo Procurement", async (c, scope) => {
  const admin = await anyAdmin(c);

  // ── Supplier ──────────────────────────────────────────────────────────────
  const supplierIds = new Map();
  for (const [kode, nama, pic, phone, kota, kategori, catatan, terms] of SUPPLIERS) {
    const { rows } = await c.query(
      `INSERT INTO purchasing.suppliers
         (kode, nama_supplier, pic_name, pic_phone, telepon, kota, kategori, catatan,
          payment_terms, currency, status, is_active, company_id, branch_id, created_by)
       VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,'IDR','active',true,$9,$10,$11)
       ON CONFLICT (
         COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
         COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
         kode
       ) WHERE deleted_at IS NULL
       DO UPDATE SET
         nama_supplier = EXCLUDED.nama_supplier,
         pic_name = EXCLUDED.pic_name,
         pic_phone = EXCLUDED.pic_phone,
         telepon = EXCLUDED.telepon,
         kota = EXCLUDED.kota,
         kategori = EXCLUDED.kategori,
         catatan = EXCLUDED.catatan,
         payment_terms = EXCLUDED.payment_terms,
         is_active = true,
         deleted_at = NULL,
         updated_at = NOW()
       RETURNING id`,
      [kode, nama, pic, phone, kota, kategori, catatan, terms, scope.company_id, scope.branch_id, admin?.id ?? null]
    );
    supplierIds.set(kode, rows[0].id);
    console.log(`  ✓ supplier ${kode} — ${nama}`);
  }

  // ── Referensi item: produk (harga beli = HPP katalog) & bahan (harga per satuan besar) ──
  const { rows: prodRows } = await c.query(
    `SELECT id, kode, nama, satuan_id, harga_modal FROM item.products
     WHERE company_id = $1 AND deleted_at IS NULL AND is_active`,
    [scope.company_id]
  );
  const products = new Map(prodRows.map((r) => [r.kode, r]));
  const { rows: rmRows } = await c.query(
    `SELECT rm.id, rm.kode, rm.nama, rm.satuan_besar_id AS satuan_id, rm.harga_beli, u.kode AS unit
     FROM item.raw_materials rm LEFT JOIN item.units u ON u.id = rm.satuan_besar_id
     WHERE rm.company_id = $1 AND rm.deleted_at IS NULL AND rm.is_active`,
    [scope.company_id]
  );
  const materials = new Map(rmRows.map((r) => [r.kode, r]));
  const { rows: pcsRows } = await c.query(`SELECT id FROM item.units WHERE company_id = $1 AND upper(kode) = 'PCS' LIMIT 1`, [scope.company_id]);

  function resolveLine([kind, code, qty]) {
    const ref = kind === "P" ? products.get(code) : materials.get(code);
    if (!ref) throw new Error(`Item ${code} belum ada — jalankan ballooney-catalog / ballooney-supplies dulu.`);
    const price = Number(kind === "P" ? ref.harga_modal : ref.harga_beli) || 0;
    return {
      productId: kind === "P" ? ref.id : null,
      rawMaterialId: kind === "R" ? ref.id : null,
      satuanId: ref.satuan_id ?? pcsRows[0]?.id ?? null,
      unit: kind === "P" ? "PCS" : ref.unit || "PCS",
      name: ref.nama,
      qty,
      price,
      subtotal: price * qty,
    };
  }

  // ── Purchase Request ──────────────────────────────────────────────────────
  // requester & department wajib: utamakan staf Procurement.
  const { rows: emp } = await c.query(
    `SELECT e.id, e.department_id FROM hris.employees e
     LEFT JOIN hris.departments d ON d.id = e.department_id
     WHERE e.is_active AND e.department_id IS NOT NULL
     ORDER BY (d.code = 'PROC') DESC, e.created_at LIMIT 1`
  );
  const requesterId = emp[0]?.id ?? null;
  const departmentId = emp[0]?.department_id ?? null;

  let prCount = 0;
  let prLines = 0;
  if (!requesterId || !departmentId) {
    console.log("  ! PR dilewati: butuh minimal 1 karyawan aktif ber-departemen (jalankan ballooney-hris dulu).");
  } else {
    for (const [nomor, prio, status, modul, notes, needDays, items] of PURCHASE_REQUESTS) {
      const lines = items.map(resolveLine);
      const total = lines.reduce((n, l) => n + l.subtotal, 0);
      const { rows } = await c.query(
        `INSERT INTO purchasing.purchase_requests
           (pr_number, requester_id, department_id, status, total_amount, priority, notes,
            required_date, company_id, branch_id, module_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,$11)
         ON CONFLICT (pr_number) DO UPDATE SET
           status = EXCLUDED.status, total_amount = EXCLUDED.total_amount, priority = EXCLUDED.priority,
           notes = EXCLUDED.notes, required_date = EXCLUDED.required_date, module_type = EXCLUDED.module_type,
           updated_at = NOW()
         RETURNING id`,
        [nomor, requesterId, departmentId, status, total, prio, notes, dayFrom(needDays), scope.company_id, scope.branch_id, modul]
      );
      const prId = rows[0].id;
      await c.query(`DELETE FROM purchasing.pr_items WHERE pr_id = $1`, [prId]);
      for (const l of lines) {
        await c.query(
          `INSERT INTO purchasing.pr_items
             (pr_id, product_id, raw_material_id, satuan_id, description, qty, unit, estimated_price, total)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [prId, l.productId, l.rawMaterialId, l.satuanId, l.name, l.qty, l.unit, l.price, l.subtotal]
        );
        prLines += 1;
      }
      prCount += 1;
      console.log(`  ✓ PR ${nomor} (${status}, ${modul}) — ${lines.length} item, Rp ${total.toLocaleString("id-ID")}`);
    }
  }

  // ── Purchase Order ────────────────────────────────────────────────────────
  const PPN = 11;
  let poCount = 0;
  let poLines = 0;
  for (const [nomor, supKode, status, modul, catatan, poDay, kirimDay, items] of PURCHASE_ORDERS) {
    const lines = items.map(resolveLine);
    const subtotal = lines.reduce((n, l) => n + l.subtotal, 0);
    const ppn = Math.round((subtotal * PPN) / 100);
    const received = status === "received";
    const { rows } = await c.query(
      `INSERT INTO purchasing.purchase_orders
         (nomor_po, tanggal_po, tanggal_dibutuhkan, tanggal_kirim_estimasi, supplier_id, status,
          subtotal, ppn_persen, ppn_nominal, total, catatan, alamat_pengiriman, is_active,
          company_id, branch_id, module_type, source_type, created_by)
       VALUES ($1,$2::date,$3::date,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13,$14,'manual',$15)
       ON CONFLICT (nomor_po) DO UPDATE SET
         status = EXCLUDED.status, supplier_id = EXCLUDED.supplier_id, subtotal = EXCLUDED.subtotal,
         ppn_persen = EXCLUDED.ppn_persen, ppn_nominal = EXCLUDED.ppn_nominal, total = EXCLUDED.total,
         catatan = EXCLUDED.catatan, alamat_pengiriman = EXCLUDED.alamat_pengiriman,
         module_type = EXCLUDED.module_type, is_active = true, deleted_at = NULL, updated_at = NOW()
       RETURNING id`,
      [
        nomor, dayFrom(poDay), dayFrom(kirimDay), supplierIds.get(supKode) ?? null, status,
        subtotal, PPN, ppn, subtotal + ppn, catatan,
        "Ballooney — Ruko Fluorite No. 66, Gading Serpong, Kab. Tangerang, Banten",
        scope.company_id, scope.branch_id, modul, admin?.id ?? null,
      ]
    );
    const poId = rows[0].id;
    await c.query(`DELETE FROM purchasing.purchase_order_items WHERE purchase_order_id = $1`, [poId]);
    for (const l of lines) {
      await c.query(
        `INSERT INTO purchasing.purchase_order_items
           (purchase_order_id, product_id, raw_material_id, satuan_id, qty_ordered, qty_received,
            harga_satuan, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
        [poId, l.productId, l.rawMaterialId, l.satuanId, l.qty, received ? l.qty : 0, l.price]
      );
      poLines += 1;
    }
    poCount += 1;
    console.log(`  ✓ PO ${nomor} — ${catatan} (${status}) Rp ${(subtotal + ppn).toLocaleString("id-ID")}`);
  }

  return {
    supplier: SUPPLIERS.length,
    "purchase request": `${prCount} (${prLines} baris)`,
    "purchase order": `${poCount} (${poLines} baris)`,
  };
});
