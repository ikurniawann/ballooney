#!/usr/bin/env node
/**
 * Seeder demo HRIS Ballooney: karyawan toko, admin order, workshop florist & balon,
 * kru dekorasi lapangan; shift kerja; kontrak.
 *
 * Melengkapi hris-master-data.js (departemen/jabatan/status kepegawaian) yang
 * hanya mengisi master. Tanpa karyawan ber-departemen, modul lain ikut macet —
 * mis. Purchase Request wajib punya requester + department.
 *
 * Shift & kontrak kerja belum pernah punya seeder sama sekali; keduanya hanya
 * pernah DIHAPUS oleh reset dari xlsx.
 *
 * Idempotent: karyawan upsert per NIP, shift per nama, kontrak per nomor.
 *
 * Usage:
 *   node database/seeders/ballooney-demo-hris.js
 *   npm run db:seed:ballooney-hris
 */

const { dayFrom, runSeeder } = require("./lib/ballooney-demo");

/** [nama, nip, email, telepon, departemen_code, jabatan, status, gender, kota, mulai_kerja_hari, kode_cabang_lokasi_kerja]
 *  Satu lokasi kerja (BALLOONEY-HQ = Toko & Workshop Gading Serpong). Jabatan khas
 *  Ballooney (Florist, Balloon Artist, kru dekorasi) belum ada di master jabatan —
 *  tetap ditulis di kontrak, job_title_id dibiarkan kosong. */
const EMPLOYEES = [
  ["Stefani Gunawan", "BLN-1001", "stefani.gunawan@ballooney.co.id", "081290001001", "OPS", "Director", "permanent", "female", "Kab. Tangerang", -2000, "BALLOONEY-HQ"],
  ["Rizky Ananda", "BLN-1002", "rizky.ananda@ballooney.co.id", "081290001002", "OPS", "Operations Manager", "permanent", "male", "Tangerang Selatan", -1500, "BALLOONEY-HQ"],
  ["Salsa Ramadhani", "BLN-1003", "salsa.ramadhani@ballooney.co.id", "081290001003", "RTL", "Store Cashier", "contract", "female", "Kab. Tangerang", -300, "BALLOONEY-HQ"],
  ["Aulia Rahma", "BLN-1004", "aulia.rahma@ballooney.co.id", "081290001004", "ECOM", "Customer Service Online", "contract", "female", "Kota Tangerang", -420, "BALLOONEY-HQ"],
  ["Nadia Safitri", "BLN-1005", "nadia.safitri@ballooney.co.id", "081290001005", "ECOM", "Customer Service Online", "probation", "female", "Kab. Tangerang", -60, "BALLOONEY-HQ"],
  ["Putri Maharani", "BLN-1006", "putri.maharani@ballooney.co.id", "081290001006", "PRD", "Head Florist", "permanent", "female", "Tangerang Selatan", -1100, "BALLOONEY-HQ"],
  ["Intan Permata", "BLN-1007", "intan.permata@ballooney.co.id", "081290001007", "PRD", "Florist", "contract", "female", "Kab. Tangerang", -240, "BALLOONEY-HQ"],
  ["Dimas Kurniawan", "BLN-1008", "dimas.kurniawan@ballooney.co.id", "081290001008", "PRD", "Balloon Artist / Decorator", "permanent", "male", "Kab. Tangerang", -980, "BALLOONEY-HQ"],
  ["Tiara Wulandari", "BLN-1009", "tiara.wulandari@ballooney.co.id", "081290001009", "PRD", "Balloon Artist / Decorator", "contract", "female", "Kota Tangerang", -330, "BALLOONEY-HQ"],
  ["Yoga Firmansyah", "BLN-1010", "yoga.firmansyah@ballooney.co.id", "081290001010", "OPS", "Koordinator Dekorasi Lapangan", "permanent", "male", "Kab. Tangerang", -870, "BALLOONEY-HQ"],
  ["Fajar Nugroho", "BLN-1011", "fajar.nugroho@ballooney.co.id", "081290001011", "OPS", "Kru Pemasangan Dekorasi", "contract", "male", "Kab. Tangerang", -200, "BALLOONEY-HQ"],
  ["Rina Oktaviani", "BLN-1012", "rina.oktaviani@ballooney.co.id", "081290001012", "WHL", "Admin Gudang & Aset", "permanent", "female", "Kab. Tangerang", -720, "BALLOONEY-HQ"],
  ["Ayu Lestari", "BLN-1013", "ayu.lestari@ballooney.co.id", "081290001013", "PROC", "Purchasing Staff", "permanent", "female", "Tangerang Selatan", -540, "BALLOONEY-HQ"],
  ["Hendra Saputra", "BLN-1014", "hendra.saputra@ballooney.co.id", "081290001014", "FIN", "Accounting Supervisor", "permanent", "male", "Jakarta Barat", -800, "BALLOONEY-HQ"],
  ["Michelle Tan", "BLN-1015", "michelle.tan@ballooney.co.id", "081290001015", "MKT", "Content Creator", "contract", "female", "Tangerang Selatan", -180, "BALLOONEY-HQ"],
  ["Bagas Pratama", "BLN-1016", "bagas.pratama@ballooney.co.id", "081290001016", "GA", "Driver", "contract", "male", "Kab. Tangerang", -400, "BALLOONEY-HQ"],
  ["Andre Wijaya", "BLN-1017", "andre.wijaya@ballooney.co.id", "081290001017", "OPS", "Kru Pemasangan Dekorasi", "probation", "male", "Kab. Tangerang", -45, "BALLOONEY-HQ"],
  ["Kevin Halim", "BLN-1018", "kevin.halim@ballooney.co.id", "081290001018", "PRD", "Graphic Designer", "permanent", "male", "Kota Tangerang", -650, "BALLOONEY-HQ"],
  ["Citra Lestari", "BLN-1019", "citra.lestari@ballooney.co.id", "081290001019", "SLS", "Sales Representative", "permanent", "female", "Jakarta Barat", -460, "BALLOONEY-HQ"],
];

/** [nama, mulai, selesai, istirahat_menit, toleransi_menit, lintas_hari, urutan]
 *  — toko buka 09.00–18.00; admin order WA melayani sampai malam; kru dekorasi
 *  mengikuti jadwal acara (loading pagi, bongkar malam). */
const SHIFTS = [
  ["Toko & Admin Order", "08:30", "17:30", 60, 10, false, 1],
  ["Workshop Produksi", "08:00", "17:00", 60, 10, false, 2],
  ["Admin Order Sore (WA)", "12:00", "21:00", 60, 10, false, 3],
  ["Kru Dekorasi Loading Pagi", "05:00", "14:00", 60, 15, false, 4],
  ["Bongkar Dekorasi Malam", "21:00", "02:00", 30, 15, true, 5],
];

runSeeder("Seeding demo HRIS", async (c, scope) => {
  void scope;

  // ── Shift kerja ───────────────────────────────────────────────────────────
  for (const [nama, mulai, selesai, istirahat, toleransi, lintas, urut] of SHIFTS) {
    const { rows } = await c.query(`SELECT id FROM hris.shifts WHERE lower(name) = lower($1) LIMIT 1`, [nama]);
    if (rows[0]) {
      await c.query(
        `UPDATE hris.shifts
         SET start_time = $2, end_time = $3, break_minutes = $4, late_tolerance_minutes = $5,
             is_overnight = $6, sort_order = $7, is_active = true, updated_at = NOW()
         WHERE id = $1`,
        [rows[0].id, mulai, selesai, istirahat, toleransi, lintas, urut]
      );
    } else {
      await c.query(
        `INSERT INTO hris.shifts
           (name, start_time, end_time, break_minutes, late_tolerance_minutes, is_overnight, sort_order, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
        [nama, mulai, selesai, istirahat, toleransi, lintas, urut]
      );
    }
    console.log(`  ✓ shift ${nama} ${mulai}–${selesai}`);
  }

  // ── Karyawan ──────────────────────────────────────────────────────────────
  const { rows: deptRows } = await c.query(`SELECT id, code FROM hris.departments`);
  const deptByCode = new Map(deptRows.map((r) => [r.code, r.id]));
  const { rows: posRows } = await c.query(`SELECT id, title FROM hris.positions`);
  const posByTitle = new Map(posRows.map((r) => [r.title.toLowerCase(), r.id]));

  const employeeIds = new Map();
  for (const [nama, nip, email, phone, deptCode, jabatan, status, gender, kota, joinOffset] of EMPLOYEES) {
    const deptId = deptByCode.get(deptCode) ?? null;
    // Jabatan yang belum ada di master tidak dipaksakan — biar tidak menulis id palsu.
    const posId = posByTitle.get(jabatan.toLowerCase()) ?? null;
    const { rows } = await c.query(
      `INSERT INTO hris.employees
         (full_name, nip, email, phone, gender, city, join_date, employment_status,
          department_id, job_title_id, is_active, is_access_app)
       VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10,true,false)
       ON CONFLICT (nip) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         gender = EXCLUDED.gender,
         city = EXCLUDED.city,
         join_date = EXCLUDED.join_date,
         employment_status = EXCLUDED.employment_status,
         department_id = EXCLUDED.department_id,
         job_title_id = COALESCE(EXCLUDED.job_title_id, hris.employees.job_title_id),
         is_active = true,
         updated_at = NOW()
       RETURNING id`,
      [nama, nip, email, phone, gender, kota, dayFrom(joinOffset), status, deptId, posId]
    );
    employeeIds.set(nip, rows[0].id);
    console.log(`  ✓ karyawan ${nip} — ${nama} (${jabatan}${posId ? "" : ", jabatan belum di master"})`);
  }

  // ── Kontrak kerja ─────────────────────────────────────────────────────────
  // Permanent = PKWTT tanpa tanggal berakhir; contract/probation = PKWT berjangka.
  let contractCount = 0;
  const { rows: branchRows } = await c.query(
    `SELECT code, name FROM configuration.branches WHERE company_id = $1`,
    [scope.company_id]
  );
  const branchName = new Map(branchRows.map((r) => [r.code, r.name]));
  for (const [nama, nip, , , deptCode, jabatan, status, , , joinOffset, lokasi] of EMPLOYEES) {
    const empId = employeeIds.get(nip);
    if (!empId) continue;
    // Constraint pkwt_no_probation menegakkan aturan ketenagakerjaan: masa
    // percobaan hanya sah pada PKWTT. Jadi karyawan berstatus probation tetap
    // PKWTT (dengan probation_end_date), bukan PKWT.
    const isPkwt = status === "contract";
    const type = isPkwt ? "pkwt" : "pkwtt"; // CHECK constraint memakai huruf kecil
    const endDate = isPkwt ? dayFrom(joinOffset + 365) : null;
    const probationEnd = status === "probation" ? dayFrom(joinOffset + 90) : null;
    const nomor = `DEMO-KTR-${nip}`;
    await c.query(
      `INSERT INTO hris.employment_contracts
         (employee_id, contract_number, contract_type, status, start_date, end_date,
          probation_end_date, sequence, position_title, department_name, work_location, notes)
       VALUES ($1,$2,$3,'active',$4::date,$5::date,$6::date,1,$7,$8,$10,$9)
       ON CONFLICT (contract_number) DO UPDATE SET
         contract_type = EXCLUDED.contract_type,
         status = EXCLUDED.status,
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         probation_end_date = EXCLUDED.probation_end_date,
         position_title = EXCLUDED.position_title,
         department_name = EXCLUDED.department_name,
         work_location = EXCLUDED.work_location,
         updated_at = NOW()`,
      [empId, nomor, type, dayFrom(joinOffset), endDate, probationEnd, jabatan, deptCode, `Kontrak demo ${nama}`,
       branchName.get(lokasi) ?? "Ballooney Gading Serpong"]
    );
    contractCount += 1;
  }
  console.log(`  ✓ kontrak kerja ${contractCount} (PKWTT tanpa tanggal berakhir, PKWT 1 tahun; lokasi kerja = cabang)`);

  return { shift: SHIFTS.length, karyawan: EMPLOYEES.length, kontrak: contractCount };
});
