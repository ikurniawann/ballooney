#!/usr/bin/env node
/**
 * Seeder demo Sales Funneling / CRM Ballooney — dekorasi event corporate (HUT
 * perusahaan, acara stasiun TV, grand opening), dekorasi ulang tahun & wisuda,
 * dan corporate gifting (balloon gift nasabah, brand launch).
 *
 * Modul ini sama sekali belum punya seeder. Data demo dibuat menyebar di
 * beberapa tahap pipeline supaya kanban, forecast, dan laporan atribusi
 * (EPIC-050) langsung ada isinya, bukan halaman kosong.
 *
 * Cakupan: alasan kalah, account, contact, lead (dengan UTM), deal di beberapa
 * tahap, dan aktivitas tindak lanjut.
 *
 * Idempotent: seluruh baris demo ditandai prefix "DEMO" pada nama/kode dan
 * di-upsert; dijalankan ulang tidak menggandakan.
 *
 * Usage:
 *   node database/seeders/ballooney-demo-sales-funnel.js
 *   npm run db:seed:ballooney-sales-funnel
 */

const { dayFrom, runSeeder, anyAdmin } = require("./lib/ballooney-demo");

const LOST_REASONS = [
  ["HARGA", "Harga di atas anggaran", 1],
  ["MOQ", "Skala acara di bawah minimum order dekorasi", 2],
  ["JADWAL", "Tanggal acara bentrok — kru & aset dekorasi penuh", 3],
  ["KOMPETITOR", "Memilih vendor dekorasi lain", 4],
  ["BATAL", "Acara dibatalkan / ditunda", 5],
  ["TIDAK-RESPON", "Tidak ada respons setelah penawaran", 6],
];

/** Pipeline default dinamai ulang untuk Ballooney: dekorasi event & corporate gift. */
const PIPELINE_NAME = "Dekorasi Event & Corporate Gift";
const STAGE_NAMES = {
  "prospek-baru": "Prospek Baru",
  dihubungi: "Dihubungi",
  proposal: "Moodboard & Penawaran",
  "nego-survey": "Nego & Survey Venue",
  menang: "Menang (DP Diterima)",
  kalah: "Kalah",
};

/** [nama, tipe, industri, kota, telepon, email] — semua fiktif */
const ACCOUNTS = [
  ["Bank Nusantara Digital", "corporate", "Perbankan", "Jakarta Selatan", "0211234501", "brand@banknusantara.co.id"],
  ["PT Kopi Senja Indonesia", "corporate", "F&B", "Tangerang Selatan", "0211234502", "marketing@kopisenja.id"],
  ["Stasiun TV Nusantara Satu", "corporate", "Media & Penyiaran", "Jakarta Barat", "0211234503", "produksi@nusantarasatu.tv"],
  ["Keluarga Hartono", "perorangan", "Perorangan", "Kab. Tangerang", "0211234504", "linda.hartono@gmail.com"],
  ["Sekolah Bina Kasih Gading Serpong", "sekolah", "Pendidikan", "Kab. Tangerang", "0211234505", "humas@binakasih.sch.id"],
];

/** [nama_account, nama_kontak, jabatan, telepon, email, utama] */
const CONTACTS = [
  ["Bank Nusantara Digital", "Sri Handayani", "Brand Activation Lead", "081310003001", "sri@banknusantara.co.id", true],
  ["Bank Nusantara Digital", "Rudi Hermawan", "Staff GA", "081310003002", "rudi@banknusantara.co.id", false],
  ["PT Kopi Senja Indonesia", "Melati Anggraini", "Marketing Manager", "081310003003", "melati@kopisenja.id", true],
  ["Stasiun TV Nusantara Satu", "Yoga Permana", "Art Director Produksi", "081310003004", "yoga@nusantarasatu.tv", true],
  ["Keluarga Hartono", "Linda Hartono", "Orang Tua (pemesan)", "081310003005", "linda.hartono@gmail.com", true],
  ["Sekolah Bina Kasih Gading Serpong", "Maria Fransiska", "Kepala Humas Sekolah", "081310003006", "maria@binakasih.sch.id", true],
];

/**
 * [instansi, tipe, pic, telepon, email, kota, sumber, temperatur, status,
 *  utm_source, utm_campaign, hari_dibuat, catatan]
 */
const LEADS = [
  ["Bank Nusantara Digital", "corporate", "Sri Handayani", "081310003001", "sri@banknusantara.co.id", "Jakarta Selatan", "referral", "panas", "qualified", null, null, -21, "HUT ke-25: dekorasi lobby kantor pusat + 150 balloon gift untuk nasabah prioritas"],
  ["PT Kopi Senja Indonesia", "corporate", "Melati Anggraini", "081310003003", "melati@kopisenja.id", "Tangerang Selatan", "google", "hangat", "qualified", "google", "dekorasi-grand-opening", -14, "Grand opening outlet BSD: balloon arch, standing flower, backdrop foto"],
  ["Stasiun TV Nusantara Satu", "corporate", "Yoga Permana", "081310003004", "yoga@nusantarasatu.tv", "Jakarta Barat", "instagram", "hangat", "dihubungi", "instagram", "portofolio-corporate", -10, "Dekorasi set studio acara ulang tahun stasiun TV, live 3 jam"],
  ["Keluarga Hartono", "perorangan", "Linda Hartono", "081310003005", "linda.hartono@gmail.com", "Kab. Tangerang", "instagram", "panas", "qualified", "instagram", "sweet-seventeen", -7, "Sweet seventeen di ballroom hotel Gading Serpong, tema pink – rose gold"],
  ["Sekolah Bina Kasih Gading Serpong", "sekolah", "Maria Fransiska", "081310003006", "maria@binakasih.sch.id", "Kab. Tangerang", "wa", "hangat", "baru", null, null, -4, "Wisuda TK & SD: backdrop panggung + bouquet balon wisuda per siswa"],
  ["PT Glowlab Kosmetika", "corporate", "Nadia Kusuma", "081310003007", "nadia@glowlab.co.id", "Jakarta Utara", "google", "dingin", "baru", "google", "search-balloon-box-corporate", -2, "Tanya harga 100 balloon box PR package untuk launching produk"],
];

/** [instansi, judul, jenis, nilai, tahap_code, hari_acara, estimasi_pax] — jenis: event_type sistem
 *  ('gathering' = acara corporate, 'ulang-tahun' = pesta ulang tahun, 'lainnya' = grand opening/wisuda/gifting) */
const DEALS = [
  ["Bank Nusantara Digital", "HUT ke-25 Bank Nusantara Digital — Dekorasi Lobby & 150 Balloon Gift", "gathering", 45_000_000, "nego-survey", 20, 150],
  ["PT Kopi Senja Indonesia", "Grand Opening Kopi Senja BSD — Balloon Arch & Standing Flower", "lainnya", 18_500_000, "proposal", 25, 200],
  ["Stasiun TV Nusantara Satu", "Dekorasi Set Studio HUT Stasiun TV Nusantara Satu", "gathering", 65_000_000, "dihubungi", 45, 500],
  ["Keluarga Hartono", "Sweet Seventeen Clarissa Hartono — Dekorasi Ballroom", "ulang-tahun", 25_000_000, "menang", 12, 250],
  ["Sekolah Bina Kasih Gading Serpong", "Wisuda TK & SD Bina Kasih — Backdrop & 120 Bouquet Wisuda", "lainnya", 21_000_000, "prospek-baru", 60, 120],
];

/** [instansi, jenis, judul, catatan, hari_jatuh_tempo, status] */
const ACTIVITIES = [
  ["Bank Nusantara Digital", "meeting", "Survey lobby kantor pusat", "Ukur area lobby untuk balloon arch, backdrop & meja gift nasabah", 1, "open"],
  ["PT Kopi Senja Indonesia", "wa", "Kirim moodboard grand opening", "3 opsi tema: earth tone, pastel, hitam – gold + estimasi biaya", 0, "open"],
  ["Stasiun TV Nusantara Satu", "email", "Kirim company profile & portofolio acara TV", "Sertakan price list dekorasi 2026 dan foto set acara TV sebelumnya", 2, "open"],
  ["Sekolah Bina Kasih Gading Serpong", "telepon", "Perkenalan paket wisuda", "Tawarkan paket backdrop panggung + bouquet balon per siswa", 3, "open"],
  ["Bank Nusantara Digital", "catatan", "Hasil diskusi kebutuhan", "Warna brand biru – putih, balloon gift isi helium + kartu ucapan logo bank", -3, "done"],
  ["Keluarga Hartono", "telepon", "Konfirmasi DP & jadwal loading", "DP 50% sudah masuk, loading ballroom H-1 pukul 14.00", -1, "done"],
];

runSeeder("Seeding demo Sales Funneling", async (c, scope) => {
  const admin = await anyAdmin(c);
  const ownerId = admin?.id ?? null;

  // ── Alasan kalah ──────────────────────────────────────────────────────────
  for (const [code, name, sort] of LOST_REASONS) {
    await c.query(
      `INSERT INTO crm.crm_sales_lost_reasons (code, name, sort_order, is_active)
       VALUES ($1,$2,$3,true)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order,
         is_active = true, updated_at = NOW()`,
      [code, name, sort]
    );
  }
  await c.query(
    `UPDATE crm.crm_sales_lost_reasons SET is_active = false, updated_at = NOW()
     WHERE code = ANY($1::text[])`,
    [["harga", "kompetitor", "jadwal", "batal-acara", "tidak-respon"]]
  );
  console.log(`  ✓ alasan kalah ${LOST_REASONS.length}`);

  // ── Pipeline default → Dekorasi Event Ballooney ───────────────────────────
  const { rows: defPipe } = await c.query(`SELECT id FROM crm.crm_pipelines WHERE is_default LIMIT 1`);
  if (defPipe[0]) {
    await c.query(`UPDATE crm.crm_pipelines SET name = $2, updated_at = NOW() WHERE id = $1`, [defPipe[0].id, PIPELINE_NAME]);
    for (const [code, name] of Object.entries(STAGE_NAMES)) {
      await c.query(
        `UPDATE crm.crm_sales_stages SET name = $3, updated_at = NOW() WHERE pipeline_id = $1 AND code = $2`,
        [defPipe[0].id, code, name]
      );
    }
    console.log(`  ✓ pipeline default → ${PIPELINE_NAME}`);
  }
  await c.query(
    `UPDATE crm.crm_pipelines SET name = 'Corporate Gifting & Hampers', updated_at = NOW()
     WHERE name IN ('B2B Kopi & Katering', 'Reseller & Konsinyasi')`
  );

  // ── Account ───────────────────────────────────────────────────────────────
  const accountIds = new Map();
  for (const [nama, tipe, industri, kota, telepon, email] of ACCOUNTS) {
    const { rows: found } = await c.query(
      `SELECT id FROM crm.crm_accounts WHERE company_id = $1 AND lower(name) = lower($2) AND deleted_at IS NULL LIMIT 1`,
      [scope.company_id, nama]
    );
    let id = found[0]?.id;
    if (id) {
      await c.query(
        `UPDATE crm.crm_accounts SET account_type=$2, industry=$3, city=$4, phone=$5, email=$6,
           owner_user_id = COALESCE(owner_user_id, $7), updated_at = NOW() WHERE id = $1`,
        [id, tipe, industri, kota, telepon, email, ownerId]
      );
    } else {
      const { rows } = await c.query(
        `INSERT INTO crm.crm_accounts (company_id, branch_id, name, account_type, industry, city, phone, email, owner_user_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING id`,
        [scope.company_id, scope.branch_id, nama, tipe, industri, kota, telepon, email, ownerId]
      );
      id = rows[0].id;
    }
    accountIds.set(nama, id);
  }
  console.log(`  ✓ account ${ACCOUNTS.length}`);

  // ── Contact ───────────────────────────────────────────────────────────────
  for (const [accNama, nama, jabatan, telepon, email, utama] of CONTACTS) {
    const accId = accountIds.get(accNama) ?? null;
    const { rows: found } = await c.query(
      `SELECT id FROM crm.crm_contacts WHERE company_id = $1 AND phone = $2 AND deleted_at IS NULL LIMIT 1`,
      [scope.company_id, telepon]
    );
    if (found[0]) {
      await c.query(
        `UPDATE crm.crm_contacts SET name=$2, title=$3, email=$4, account_id=$5, is_primary=$6, updated_at=NOW() WHERE id=$1`,
        [found[0].id, nama, jabatan, email, accId, utama]
      );
    } else {
      await c.query(
        `INSERT INTO crm.crm_contacts (company_id, branch_id, account_id, name, title, phone, email, is_primary, owner_user_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
        [scope.company_id, scope.branch_id, accId, nama, jabatan, telepon, email, utama, ownerId]
      );
    }
  }
  console.log(`  ✓ contact ${CONTACTS.length}`);

  // ── Lead ──────────────────────────────────────────────────────────────────
  const leadIds = new Map();
  for (const [org, tipe, pic, telepon, email, kota, sumber, temp, status, utmSource, utmCampaign, hari, catatan] of LEADS) {
    const accId = accountIds.get(org) ?? null;
    const { rows: found } = await c.query(
      `SELECT id FROM crm.crm_sales_leads WHERE company_id=$1 AND pic_phone=$2 AND lower(org_name)=lower($3) AND deleted_at IS NULL LIMIT 1`,
      [scope.company_id, telepon, org]
    );
    let id = found[0]?.id;
    if (id) {
      await c.query(
        `UPDATE crm.crm_sales_leads SET org_type=$2, pic_name=$3, pic_email=$4, city=$5, source=$6,
           temperature=$7, status=$8, notes=$9, account_id=$10, utm_source=$11, utm_campaign=$12,
           owner_user_id=COALESCE(owner_user_id,$13), updated_at=NOW() WHERE id=$1`,
        [id, tipe, pic, email, kota, sumber, temp, status, catatan, accId, utmSource, utmCampaign, ownerId]
      );
    } else {
      const { rows } = await c.query(
        `INSERT INTO crm.crm_sales_leads
           (company_id, branch_id, org_name, org_type, pic_name, pic_phone, pic_email, city, source,
            temperature, status, notes, account_id, utm_source, utm_campaign, owner_user_id, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16,$17::date)
         RETURNING id`,
        [scope.company_id, scope.branch_id, org, tipe, pic, telepon, email, kota, sumber,
         temp, status, catatan, accId, utmSource, utmCampaign, ownerId, dayFrom(hari)]
      );
      id = rows[0].id;
    }
    leadIds.set(org, id);
  }
  console.log(`  ✓ lead ${LEADS.length}`);

  // ── Deal ──────────────────────────────────────────────────────────────────
  const { rows: stageRows } = await c.query(
    `SELECT s.id, s.code FROM crm.crm_sales_stages s
     JOIN crm.crm_pipelines p ON p.id = s.pipeline_id AND p.is_default
     WHERE s.is_active`
  );
  const stageByCode = new Map(stageRows.map((r) => [r.code, r.id]));
  const { rows: pipelineRows } = await c.query(`SELECT id FROM crm.crm_pipelines WHERE is_default LIMIT 1`);
  const pipelineId = pipelineRows[0]?.id ?? null;

  let dealCount = 0;
  for (const [org, judul, jenis, nilai, stageCode, hariAcara, pax] of DEALS) {
    const leadId = leadIds.get(org);
    const stageId = stageByCode.get(stageCode);
    if (!leadId || !stageId) {
      console.log(`  ! deal "${judul}" dilewati (lead/tahap ${stageCode} tidak ditemukan)`);
      continue;
    }
    const { rows: found } = await c.query(
      `SELECT id FROM crm.crm_sales_deals WHERE company_id=$1 AND lower(title)=lower($2) AND deleted_at IS NULL LIMIT 1`,
      [scope.company_id, judul]
    );
    if (found[0]) {
      await c.query(
        `UPDATE crm.crm_sales_deals SET stage_id=$2, value_estimate=$3, event_date=$4::date,
           pax_estimate=$5, pipeline_id=COALESCE(pipeline_id,$6), updated_at=NOW() WHERE id=$1`,
        [found[0].id, stageId, nilai, dayFrom(hariAcara), pax, pipelineId]
      );
    } else {
      await c.query(
        `INSERT INTO crm.crm_sales_deals
           (company_id, branch_id, lead_id, title, event_type, event_date, pax_estimate,
            stage_id, pipeline_id, value_estimate, owner_user_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10,$11,$11)`,
        [scope.company_id, scope.branch_id, leadId, judul, jenis, dayFrom(hariAcara), pax,
         stageId, pipelineId, nilai, ownerId]
      );
    }
    dealCount += 1;
  }
  console.log(`  ✓ deal ${dealCount}`);

  // ── Aktivitas / tugas ─────────────────────────────────────────────────────
  let actCount = 0;
  for (const [org, jenis, judul, catatan, hari, status] of ACTIVITIES) {
    const leadId = leadIds.get(org);
    if (!leadId) continue;
    const { rows: found } = await c.query(
      `SELECT id FROM crm.crm_sales_activities WHERE company_id=$1 AND lead_id=$2 AND title=$3 AND deleted_at IS NULL LIMIT 1`,
      [scope.company_id, leadId, judul]
    );
    const dueAt = `${dayFrom(hari)} 09:00:00+07`;
    if (found[0]) {
      await c.query(
        `UPDATE crm.crm_sales_activities SET activity_type=$2, notes=$3, due_at=$4::timestamptz,
           status=$5, done_at=$6::timestamptz, updated_at=NOW() WHERE id=$1`,
        [found[0].id, jenis, catatan, dueAt, status, status === "done" ? dueAt : null]
      );
    } else {
      await c.query(
        `INSERT INTO crm.crm_sales_activities
           (company_id, branch_id, lead_id, activity_type, title, notes, due_at, status, done_at,
            priority, subject_type, subject_id, owner_user_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9::timestamptz,'normal','lead',$3,$10,$10)`,
        [scope.company_id, scope.branch_id, leadId, jenis, judul, catatan, dueAt, status,
         status === "done" ? dueAt : null, ownerId]
      );
    }
    actCount += 1;
  }
  console.log(`  ✓ aktivitas ${actCount}`);

  return {
    "alasan kalah": LOST_REASONS.length,
    account: ACCOUNTS.length,
    contact: CONTACTS.length,
    lead: LEADS.length,
    deal: dealCount,
    aktivitas: actCount,
  };
});
