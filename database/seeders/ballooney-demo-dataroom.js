#!/usr/bin/env node
/**
 * Seeder demo Dataroom Ballooney: struktur folder + dokumen contoh usaha gift
 * balon & bunga dan dekorasi event (nama berkas = placeholder).
 *
 * Modul ini belum punya seeder sama sekali. Yang dibuat hanya METADATA node
 * (dataroom.nodes) — berkas fisiknya tidak diunggah, jadi dokumen demo tampil
 * di pohon folder tapi tidak bisa diunduh. Itu disengaja: seeder tidak boleh
 * mengarang isi dokumen perusahaan.
 *
 * Idempotent: node dikenali lewat kombinasi (parent, nama).
 *
 * Usage:
 *   node database/seeders/ballooney-demo-dataroom.js
 *   npm run db:seed:ballooney-dataroom
 */

const { runSeeder, anyAdmin } = require("./lib/ballooney-demo");

/**
 * Pohon folder. Tiap simpul: { name, children?, docs? }
 * docs: [nama_berkas, mime, ukuran_byte]
 */
const TREE = [
  {
    name: "Legal & Perizinan",
    docs: [
      ["Akta Pendirian CV Balon Jaya.pdf", "application/pdf", 1_842_000],
      ["NIB CV Balon Jaya (OSS).pdf", "application/pdf", 962_000],
      ["NPWP CV Balon Jaya.pdf", "application/pdf", 420_000],
      ["Sertifikat Merek Ballooney (DJKI).pdf", "application/pdf", 1_120_000],
    ],
  },
  {
    name: "Keuangan",
    children: [
      { name: "Laporan Bulanan", docs: [["Laporan Laba Rugi.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 248_000]] },
      { name: "DP & Pelunasan Proyek", docs: [["Rekap DP & Pelunasan Dekorasi.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 296_000]] },
      { name: "Rekonsiliasi Marketplace", docs: [["Rekap Pencairan Tokopedia & Shopee.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 212_000]] },
      { name: "Pajak", docs: [["Bukti Setor PPh Final.pdf", "application/pdf", 410_000]] },
    ],
  },
  {
    name: "Penjualan & Corporate",
    docs: [
      ["Company Profile Ballooney 2026.pdf", "application/pdf", 14_600_000],
      ["Price List Dekorasi 2026.pdf", "application/pdf", 3_480_000],
      ["Price List Corporate Gift & Balloon Box 2026.pdf", "application/pdf", 2_960_000],
      ["Template Penawaran Dekorasi Event.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 136_000],
      ["Template Surat Perjanjian Dekorasi (DP 50%).docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 148_000],
    ],
  },
  {
    name: "Operasional Toko & Workshop",
    children: [
      {
        name: "SOP",
        docs: [
          ["SOP Kasir & Input Order WhatsApp.pdf", "application/pdf", 780_000],
          ["SOP Produksi Buket & Balloon Box.pdf", "application/pdf", 860_000],
          ["SOP Penyimpanan Bunga Segar (Chiller).pdf", "application/pdf", 540_000],
          ["SOP Keselamatan Tabung Helium.pdf", "application/pdf", 610_000],
          ["SOP Stock Opname Bulanan.pdf", "application/pdf", 520_000],
        ],
      },
      { name: "Pengiriman", docs: [["SOP Packing & Antar Balon Helium.pdf", "application/pdf", 560_000], ["Tarif Kurir Tangerang & Jakarta.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 84_000]] },
    ],
  },
  {
    name: "Dekorasi & Event",
    children: [
      { name: "SOP Lapangan", docs: [["SOP Pemasangan Dekorasi di Venue.pdf", "application/pdf", 910_000], ["Checklist Loading & Bongkar Dekorasi.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 96_000]] },
      { name: "Aset Sewa", docs: [["Daftar Aset Dekorasi (Backdrop, Flatbase, Neon Box).xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 188_000], ["Kontrak Sewa Aset Dekorasi.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 142_000]] },
      { name: "Portofolio", docs: [["Portofolio Dekorasi Corporate & TV.pdf", "application/pdf", 22_400_000], ["Moodboard Tema Dekorasi 2026.pdf", "application/pdf", 18_400_000]] },
    ],
  },
  {
    name: "SDM",
    children: [
      { name: "Template Kontrak", docs: [["Template PKWT.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 142_000], ["Template PKWTT.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 138_000], ["Template Kontrak Kru Harian Lepas.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 118_000]] },
      { name: "Peraturan Perusahaan", docs: [["Peraturan Perusahaan 2026.pdf", "application/pdf", 1_560_000]] },
    ],
  },
  {
    name: "Marketing",
    children: [
      { name: "Brand Guideline", docs: [["Ballooney Brand Guideline.pdf", "application/pdf", 5_120_000]] },
      { name: "Materi Promosi", docs: [["Konten Feed Instagram @ballooney.id.zip", "application/zip", 12_400_000], ["Kalender Konten Musiman 2026.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 92_000]] },
    ],
  },
  {
    name: "Pengadaan",
    docs: [
      ["Daftar Supplier Balon, Helium & Bunga.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 118_000],
      ["Template Purchase Order.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 88_000],
    ],
  },
];

async function upsertNode(c, { parentId, kind, name, mime, size, admin }) {
  const { rows: found } = await c.query(
    `SELECT id FROM dataroom.nodes
     WHERE name = $1 AND kind = $2
       AND ((parent_id IS NULL AND $3::uuid IS NULL) OR parent_id = $3)
     LIMIT 1`,
    [name, kind, parentId]
  );
  if (found[0]) {
    await c.query(
      `UPDATE dataroom.nodes SET mime = $2, size_bytes = $3, updated_at = NOW() WHERE id = $1`,
      [found[0].id, mime, size]
    );
    return found[0].id;
  }
  const { rows } = await c.query(
    `INSERT INTO dataroom.nodes (parent_id, kind, name, mime, size_bytes, created_by, created_by_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [parentId, kind, name, mime, size, admin?.id ?? null, admin?.full_name ?? "Seeder"]
  );
  return rows[0].id;
}

runSeeder("Seeding demo Dataroom", async (c, scope) => {
  void scope;
  const admin = await anyAdmin(c);
  let folders = 0;
  let docs = 0;

  async function walk(nodes, parentId, depth) {
    for (const node of nodes) {
      const folderId = await upsertNode(c, {
        // size_bytes NOT NULL: folder memakai 0, bukan null.
        parentId, kind: "folder", name: node.name, mime: null, size: 0, admin,
      });
      folders += 1;
      console.log(`  ${"  ".repeat(depth)}📁 ${node.name}`);
      for (const [fileName, mime, size] of node.docs ?? []) {
        await upsertNode(c, { parentId: folderId, kind: "file", name: fileName, mime, size, admin });
        docs += 1;
        console.log(`  ${"  ".repeat(depth + 1)}📄 ${fileName}`);
      }
      if (node.children) await walk(node.children, folderId, depth + 1);
    }
  }

  await walk(TREE, null, 0);
  console.log(
    "\n  Catatan: metadata saja — berkas fisik tidak diunggah, jadi dokumen demo tidak bisa diunduh."
  );
  return { folder: folders, dokumen: docs };
});
