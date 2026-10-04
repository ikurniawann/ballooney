#!/usr/bin/env node
/**
 * Seeder demo Accounting Ballooney: akun COA usaha gift & dekorasi, tahun buku,
 * periode, dan jurnal contoh (penjualan toko & order online, HPP, DP & pendapatan
 * proyek dekorasi, pembelian bahan & boneka, isi ulang helium, gaji, sewa ruko,
 * transport kru, biaya marketplace).
 *
 * COA bawaan (dari template SULU) berorientasi F&B. Akun F&B TIDAK diubah
 * karena kodenya dipakai kode aplikasi (src/lib/purchasing/raw-material-coa.ts);
 * di sini hanya DITAMBAH akun usaha Ballooney di bawah induk yang sama, plus nama
 * beberapa akun induk dinetralkan (mis. "FB EXPENSES" → "OPERATING EXPENSES").
 *
 * Jurnal demo dibuat berpasangan (debit = kredit) dan diverifikasi seimbang
 * sebelum commit — jurnal timpang lebih berbahaya daripada tidak ada jurnal.
 *
 * Idempotent: akun per kode, tahun buku per kode, periode per (tahun, nomor), jurnal per nomor.
 *
 * Usage:
 *   node database/seeders/ballooney-demo-accounting.js
 *   npm run db:seed:ballooney-accounting
 */

const { runSeeder, anyAdmin } = require("./lib/ballooney-demo");

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Akun induk yang namanya dinetralkan (kode tidak berubah). */
const RENAME_PARENTS = [
  ["4101000", "SALES REVENUE"],
  ["5101000", "COGS - SALES"],
  ["6000000", "OPERATING EXPENSES"],
];

/** [kode, nama, kode_induk] — akun usaha Ballooney baru; tipe/level/arus kas mengikuti induk. */
const RETAIL_ACCOUNTS = [
  ["1301009", "Inv - Persediaan Balon Siap Jual", "1301000"],
  ["1301010", "Inv - Bahan Balon, Helium, Bunga & Dekor", "1301000"],
  ["2103007", "Uang Muka Pelanggan (DP Dekorasi & Custom)", "2103000"],
  ["4101003", "Penjualan Gift & Balon - Toko", "4101000"],
  ["4101004", "Penjualan Order Online (WA, Web & Marketplace)", "4101000"],
  ["4101005", "Pendapatan Jasa Dekorasi Event", "4101000"],
  ["5101004", "HPP Balon Siap Jual", "5101000"],
  ["5101005", "HPP Produksi Gift & Bunga Custom", "5101000"],
  ["5101006", "HPP Proyek Dekorasi", "5101000"],
  ["6101004", "Toko, Workshop & Kru Dekorasi S&W", "6101000"],
  ["6301005", "Biaya Admin & Komisi Marketplace", "6301000"],
  ["6401014", "Biaya Pengiriman & Kurir", "6401000"],
];

/**
 * Jurnal contoh. Tiap baris: [nomor, deskripsi, offsetHariDariHariIni, baris[]]
 * baris: [kodeAkunCOA, 'D'|'C', jumlah, memo]
 */
function journalTemplates() {
  return [
    {
      nomor: "DEMO-JV-0001",
      deskripsi: "Penjualan harian toko Gading Serpong (tunai & QRIS)",
      offset: -7,
      lines: [
        ["1101002", "D", 1_350_000, "Kas toko"],
        ["1102001", "D", 3_870_000, "QRIS settlement"],
        ["4101003", "C", 5_220_000, "Penjualan buket, balloon box & balon foil"],
      ],
    },
    {
      nomor: "DEMO-JV-0002",
      deskripsi: "HPP penjualan toko harian",
      offset: -7,
      lines: [
        ["5101004", "D", 640_000, "HPP balon foil & latex terjual"],
        ["5101005", "D", 1_450_000, "Bahan buket & balloon box terpakai"],
        ["1301009", "C", 640_000, "Keluar persediaan balon siap jual"],
        ["1301010", "C", 1_450_000, "Keluar bahan bunga, balon curah & wrapping"],
      ],
    },
    {
      nomor: "DEMO-JV-0003",
      deskripsi: "Pencairan saldo order online marketplace (Tokopedia & Shopee)",
      offset: -6,
      lines: [
        ["1102001", "D", 4_180_000, "Dana masuk dari marketplace"],
        ["6301005", "D", 380_000, "Potongan admin & komisi marketplace"],
        ["4101004", "C", 4_560_000, "Penjualan order online"],
      ],
    },
    {
      nomor: "DEMO-JV-0004",
      deskripsi: "Penerimaan boneka bear dari PT Boneka Ceria Sejahtera (DEMO-PO-2605)",
      offset: -12,
      lines: [
        ["1301010", "D", 3_000_000, "9 lusin White, Graduation & Love Bear"],
        ["2101001", "C", 3_000_000, "Utang dagang supplier"],
      ],
    },
    {
      nomor: "DEMO-JV-0005",
      deskripsi: "DP 50% dekorasi Sweet Seventeen keluarga Hartono",
      offset: -1,
      lines: [
        ["1102001", "D", 12_500_000, "Transfer DP pelanggan"],
        ["2103007", "C", 12_500_000, "Uang muka dekorasi (belum jadi pendapatan)"],
      ],
    },
    {
      nomor: "DEMO-JV-0006",
      deskripsi: "Pembayaran gaji karyawan toko, workshop, dan kru dekorasi",
      offset: -5,
      lines: [
        ["6101004", "D", 68_500_000, "Gaji bulanan"],
        ["1102001", "C", 68_500_000, "BANK BCA 7319"],
      ],
    },
    {
      nomor: "DEMO-JV-0007",
      deskripsi: "Sewa ruko Gading Serpong bulanan",
      offset: -4,
      lines: [
        ["6401001", "D", 9_500_000, "Rent & Occupancy Expense"],
        ["1102001", "C", 9_500_000, "BANK BCA 7319"],
      ],
    },
    {
      nomor: "DEMO-JV-0008",
      deskripsi: "Isi ulang helium & transport kru dekorasi lapangan",
      offset: -3,
      lines: [
        ["1301010", "D", 1_300_000, "Isi ulang 2 tabung helium 1 m³"],
        ["6401009", "D", 850_000, "Bensin, tol & parkir mobil kru"],
        ["1101002", "C", 2_150_000, "Kas toko"],
      ],
    },
    {
      nomor: "DEMO-JV-0009",
      deskripsi: "Pelunasan utang PT Boneka Ceria Sejahtera",
      offset: -2,
      lines: [
        ["2101001", "D", 3_000_000, "Pelunasan AP"],
        ["1102001", "C", 3_000_000, "BANK BCA 7319"],
      ],
    },
    {
      nomor: "DEMO-JV-0010",
      deskripsi: "DP 50% dekorasi Gender Reveal keluarga Wibowo",
      offset: -16,
      lines: [
        ["1102001", "D", 4_000_000, "Transfer DP pelanggan"],
        ["2103007", "C", 4_000_000, "Uang muka dekorasi"],
      ],
    },
    {
      nomor: "DEMO-JV-0011",
      deskripsi: "Dekorasi Gender Reveal keluarga Wibowo selesai — pelunasan & pengakuan pendapatan",
      offset: -9,
      lines: [
        ["2103007", "D", 4_000_000, "Realisasi DP"],
        ["1102001", "D", 4_000_000, "Pelunasan transfer"],
        ["4101005", "C", 8_000_000, "Pendapatan jasa dekorasi"],
      ],
    },
    {
      nomor: "DEMO-JV-0012",
      deskripsi: "HPP proyek dekorasi Gender Reveal keluarga Wibowo",
      offset: -9,
      lines: [
        ["5101006", "D", 3_100_000, "Balon, helium, bunga & honor kru"],
        ["1301010", "C", 2_450_000, "Bahan keluar dari gudang"],
        ["1101002", "C", 650_000, "Honor kru harian lepas"],
      ],
    },
  ];
}

async function ensureRetailAccounts(c, companyId) {
  for (const [code, name] of RENAME_PARENTS) {
    await c.query(
      `UPDATE accounting.chart_of_accounts SET name = $2, updated_at = NOW()
       WHERE code = $1 AND (company_id IS NULL OR company_id = $3) AND deleted_at IS NULL`,
      [code, name, companyId]
    );
  }
  let added = 0;
  for (const [code, name, parentCode] of RETAIL_ACCOUNTS) {
    const { rows: parent } = await c.query(
      `SELECT id, company_id, account_type_id, level, is_contra, cash_flow_category
       FROM accounting.chart_of_accounts
       WHERE code = $1 AND (company_id IS NULL OR company_id = $2) AND deleted_at IS NULL LIMIT 1`,
      [parentCode, companyId]
    );
    if (!parent[0]) throw new Error(`Akun induk ${parentCode} tidak ada di COA.`);
    const p = parent[0];
    const { rows: found } = await c.query(
      `SELECT id FROM accounting.chart_of_accounts
       WHERE code = $1 AND (company_id IS NULL OR company_id = $2) AND deleted_at IS NULL LIMIT 1`,
      [code, companyId]
    );
    if (found[0]) {
      await c.query(
        `UPDATE accounting.chart_of_accounts SET name = $2, parent_id = $3, is_active = true, updated_at = NOW() WHERE id = $1`,
        [found[0].id, name, p.id]
      );
    } else {
      await c.query(
        `INSERT INTO accounting.chart_of_accounts
           (company_id, code, name, parent_id, account_type_id, level, is_postable, is_contra,
            cash_flow_category, description, is_active, is_cash_bank)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,'Akun usaha Ballooney',true,false)`,
        [p.company_id, code, name, p.id, p.account_type_id, Number(p.level) + 1, p.is_contra, p.cash_flow_category]
      );
      added += 1;
    }
  }
  return added;
}

runSeeder("Seeding demo Accounting", async (c, scope) => {
  const admin = await anyAdmin(c);
  const year = new Date().getFullYear();

  // ── Akun COA retail ───────────────────────────────────────────────────────
  const added = await ensureRetailAccounts(c, scope.company_id);
  console.log(`  ✓ akun retail ${RETAIL_ACCOUNTS.length} (${added} baru), ${RENAME_PARENTS.length} induk dinetralkan`);

  // ── Tahun buku ────────────────────────────────────────────────────────────
  const code = `FY${year}`;
  const { rows: fyFound } = await c.query(
    `SELECT id FROM accounting.fiscal_years
     WHERE code = $1 AND (company_id IS NULL OR company_id = $2) AND deleted_at IS NULL LIMIT 1`,
    [code, scope.company_id]
  );
  let fiscalYearId = fyFound[0]?.id;
  if (!fiscalYearId) {
    const { rows } = await c.query(
      `INSERT INTO accounting.fiscal_years (company_id, code, name, start_date, end_date, is_active, created_by)
       VALUES ($1,$2,$3,$4::date,$5::date,true,$6) RETURNING id`,
      [scope.company_id, code, `Tahun Buku ${year}`, `${year}-01-01`, `${year}-12-31`, admin?.id ?? null]
    );
    fiscalYearId = rows[0].id;
  }
  console.log(`  ✓ tahun buku ${code}`);

  // ── 12 periode bulanan ────────────────────────────────────────────────────
  const periodIds = new Map();
  const nowMonth = new Date().getMonth() + 1;
  for (let m = 1; m <= 12; m++) {
    const start = `${year}-${String(m).padStart(2, "0")}-01`;
    const end = new Date(year, m, 0).toISOString().slice(0, 10);
    // Bulan lampau ditutup, bulan berjalan & mendatang terbuka.
    const status = m < nowMonth ? "CLOSED" : "OPEN"; // enum huruf besar
    const { rows: found } = await c.query(
      `SELECT id FROM accounting.fiscal_periods WHERE fiscal_year_id = $1 AND period_no = $2 LIMIT 1`,
      [fiscalYearId, m]
    );
    let id = found[0]?.id;
    if (id) {
      await c.query(
        `UPDATE accounting.fiscal_periods SET name=$2, start_date=$3::date, end_date=$4::date, status=$5, updated_at=NOW() WHERE id=$1`,
        [id, `${BULAN[m - 1]} ${year}`, start, end, status]
      );
    } else {
      const { rows } = await c.query(
        `INSERT INTO accounting.fiscal_periods (fiscal_year_id, period_no, name, start_date, end_date, status)
         VALUES ($1,$2,$3,$4::date,$5::date,$6) RETURNING id`,
        [fiscalYearId, m, `${BULAN[m - 1]} ${year}`, start, end, status]
      );
      id = rows[0].id;
    }
    periodIds.set(m, id);
  }
  console.log(`  ✓ periode 12 bulan (${nowMonth - 1} ditutup, ${12 - nowMonth + 1} terbuka)`);

  // ── Jurnal ────────────────────────────────────────────────────────────────
  const { rows: coaRows } = await c.query(
    `SELECT id, code FROM accounting.chart_of_accounts
     WHERE (company_id IS NULL OR company_id = $1) AND deleted_at IS NULL`,
    [scope.company_id]
  );
  const coaByCode = new Map(coaRows.map((r) => [String(r.code), r.id]));

  let journalCount = 0;
  let skipped = 0;
  for (const tpl of journalTemplates()) {
    const missing = tpl.lines.filter(([kode]) => !coaByCode.has(kode)).map(([kode]) => kode);
    if (missing.length > 0) {
      console.log(`  ! ${tpl.nomor} dilewati — akun COA tidak ada: ${missing.join(", ")}`);
      skipped += 1;
      continue;
    }
    const debit = tpl.lines.filter(([, s]) => s === "D").reduce((a, [, , n]) => a + n, 0);
    const kredit = tpl.lines.filter(([, s]) => s === "C").reduce((a, [, , n]) => a + n, 0);
    if (debit !== kredit) throw new Error(`${tpl.nomor} tidak seimbang: debit ${debit} vs kredit ${kredit}`);

    const d = new Date();
    d.setDate(d.getDate() + tpl.offset);
    const entryDate = d.toISOString().slice(0, 10);
    const periodId = periodIds.get(d.getMonth() + 1);

    const { rows: found } = await c.query(
      `SELECT id FROM accounting.journal_entries WHERE entry_no = $1 AND deleted_at IS NULL LIMIT 1`,
      [tpl.nomor]
    );
    let entryId = found[0]?.id;
    if (entryId) {
      await c.query(
        `UPDATE accounting.journal_entries SET entry_date=$2::date, description=$3, fiscal_period_id=$4, updated_at=NOW() WHERE id=$1`,
        [entryId, entryDate, tpl.deskripsi, periodId]
      );
      await c.query(`DELETE FROM accounting.journal_entry_lines WHERE entry_id = $1`, [entryId]);
    } else {
      const { rows } = await c.query(
        `INSERT INTO accounting.journal_entries
           (company_id, entry_no, entry_date, description, fiscal_period_id, status, entry_type, source_module, created_by)
         VALUES ($1,$2,$3::date,$4,$5,'POSTED','MANUAL','seeder',$6) RETURNING id`,
        [scope.company_id, tpl.nomor, entryDate, tpl.deskripsi, periodId, admin?.id ?? null]
      );
      entryId = rows[0].id;
    }

    let sort = 1;
    for (const [kode, sisi, jumlah, memo] of tpl.lines) {
      await c.query(
        `INSERT INTO accounting.journal_entry_lines (entry_id, account_id, entry_side, amount, memo, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        // entry_side memakai huruf besar sesuai CHECK constraint.
        [entryId, coaByCode.get(kode), sisi === "D" ? "DEBIT" : "CREDIT", jumlah, memo, sort++]
      );
    }
    journalCount += 1;
    console.log(`  ✓ jurnal ${tpl.nomor} — ${tpl.deskripsi}`);
  }

  // Verifikasi akhir: tidak boleh ada jurnal demo yang timpang.
  const { rows: check } = await c.query(
    `SELECT je.entry_no,
            SUM(CASE WHEN l.entry_side = 'DEBIT' THEN l.amount ELSE 0 END) AS d,
            SUM(CASE WHEN l.entry_side = 'CREDIT' THEN l.amount ELSE 0 END) AS k
     FROM accounting.journal_entries je
     JOIN accounting.journal_entry_lines l ON l.entry_id = je.id
     WHERE je.entry_no LIKE 'DEMO-JV-%' AND je.deleted_at IS NULL
     GROUP BY je.entry_no
     HAVING SUM(CASE WHEN l.entry_side = 'DEBIT' THEN l.amount ELSE 0 END)
         <> SUM(CASE WHEN l.entry_side = 'CREDIT' THEN l.amount ELSE 0 END)`
  );
  if (check.length > 0) throw new Error(`Jurnal timpang: ${check.map((r) => r.entry_no).join(", ")}`);

  return { "akun retail": RETAIL_ACCOUNTS.length, "tahun buku": 1, periode: 12, jurnal: journalCount, dilewati: skipped };
});
