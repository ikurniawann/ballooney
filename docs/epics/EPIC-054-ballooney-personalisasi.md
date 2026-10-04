# EPIC-054: Ballooney OS — Rebrand & Personalisasi Varian Custom — `MODULE-POS`

status: ready-for-qa
environment: dev
phase: 1
priority: P1
area: Fullstack
module: `MODULE-POS`
retries: 0

## Goal

Owner (2026-10-04): buat instance baru **Ballooney** (ballooney.co.id — CV Balon Jaya, toko balon &
bunga custom + jasa dekorasi sejak 2016, Ruko Fluorite No. 66 Gading Serpong) dari basis kode Paddy.
Sama-sama retail, tetapi titik beratnya **varian custom / personalisasi**: warna balon, boneka,
wrapping, pita, kartu ucapan, tulisan nama, tema warna, pengiriman & pemasangan. Logo dan background
disesuaikan dengan brand Ballooney. Live di https://ballooney.reddie.id.

## Desain

| Bagian | Keputusan |
|---|---|
| Repo | klon `ikurniawann/paddy` (histori dipertahankan) → `ikurniawann/ballooney`; teks Paddy → Ballooney, domain `ballooney.co.id`, IG `@ballooney.id`. Epic & migrasi lama tidak diubah (catatan sejarah) |
| Brand | logo resmi situs (balon "B" + wordmark script) → `logos/ballooney-wordmark.png`, `logos/ballooney-mark.png`, favicon; merah logo `#cc232a` = `--brand-primary`, skala `--color-pink-*` dibangun ulang ke merah; preset "Ballooney Red" |
| Background | 3 wallpaper balon (Merah default, Blush, Pastel) — buket balon latex glossy, foil bintang & hati, confetti; tengah lega untuk jam & form login. Sumber: `docs/design/wallpapers/make_ballooney_wallpapers.py` |
| Katalog | 704 produk asli ballooney.co.id (WooCommerce Store API) → `database/seeders/data/ballooney-catalog.json` lewat `build_ballooney_catalog.py`; 11 kategori POS; foto 640px webp di `public/products/ballooney` |
| Mode produk | **stock** (Balon Foil, Balon Latex — 93 produk, 349 SKU ber-stok: Warna / Huruf A–Z / Angka 0–9 / Motif) = merchandise; **custom** (611 produk: buket, rangkaian bunga, gift box, konfigurasi balon, balloon art, party pack, paket dekorasi, hadiah tema, musiman) = `regular`, tanpa stok |
| Personalisasi | 17 grup bersama (`pos_modifier_groups`) ditautkan per kategori; opsi default "… sesuai foto"; harga opsi = ASUMSI demo (di situs semua opsi tampil "Rp" kosong). Buket & rangkaian bunga punya varian Ukuran Standar / Besar (+35%) / Jumbo (+75%). Teks bebas (isi kartu, nama, tanggal kirim) di catatan item |
| Kasir | merchandise ber-SKU yang punya grup personalisasi: pilih SKU → popup personalisasi (harga dasar = harga SKU, `sku_id` tetap terkirim → stok varian terpotong). Baris keranjang dipisah per SKU + opsi + catatan. Grup & opsi diurutkan `display_order`; API kasir menyaring varian/grup/opsi nonaktif. Retail: ikon palet & placeholder catatan personalisasi |
| Struktur bisnis | CV Balon Jaya (CBJ) → Ballooney → satu cabang **Ballooney Gading Serpong** (stall TOKO). Situs tidak mencantumkan toko lain; toko baru = satu entri `LOCATIONS` |
| Data demo | seeder `ballooney-*`: bahan florist & balon (51), supplier (7), HRIS (19 — florist, balloon artist, kru dekorasi), procurement, akuntansi (DP proyek dekorasi), sales funnel (dekorasi event & corporate gift), dataroom; transfer stok dilewati selama hanya 1 lokasi |
| DB instance | klon DB Paddy (schema + migrasi) → `~/docker-infra/ballooney/init-ballooney-master.sql` membuang data demo/transaksi Paddy, mengganti identitas, menyisakan admin → `npm run db:seed:ballooney` |

## Tasks

- [x] T-054.1 Klon repo, rebrand teks, logo, favicon, tema merah, wallpaper balon
- [x] T-054.2 Builder katalog + seeder katalog dua mode (stock/custom) + grup personalisasi + varian ukuran
- [x] T-054.3 Kasir: SKU → personalisasi (`src/lib/pos/merch-personalization.ts`), urutan grup, filter opsi nonaktif
- [x] T-054.4 Seeder struktur & data demo Ballooney
- [x] T-054.5 Deploy `ballooney-db` :5447 / `ballooney-app` :8134 + ingress `ballooney.reddie.id`

## Acceptance Criteria

- Given kasir memilih "Jumbo Star Foil Balloon", When memilih varian Gold lalu "Isi helium", Then keranjang berisi satu baris Rp 210.000 (150.000 + 60.000) dengan `sku_id` Gold dan catatan tulisan custom.
- Given kasir memilih buket BQ-2, When memilih Ukuran Besar dan Love Bear, Then harga = 200.000 + 70.000 + 40.000 dan opsi tampil di keranjang dengan nama spesifik ("Pita sesuai foto", bukan "Sesuai foto katalog").
- Produk custom tidak punya stok di laporan persediaan; produk stock punya stok per SKU.

## Automation Log

- 2026-10-04 — Gate: vitest 303 file / 2453 test lulus (+ test baru `merch-personalization.test.ts`,
  `orderedModifierGroups`); tsc 508 = baseline Paddy; eslint file baru bersih, `cashier-page.tsx` 26 error = baseline;
  `check-no-hardcoded-brand` OK.
- 2026-10-04 — Verifikasi UI di build produksi lokal (:8134) sebagai kasir.gs: login berlatar balon merah, katalog
  berfoto, Jumbo Star Foil → varian Gold → popup personalisasi (Isi helium +60.000, catatan) → keranjang 210.000;
  BQ-2 Ukuran Besar + Love Bear → 310.000; total 520.000. Perbaikan dari verifikasi: urutan grup acak → diurutkan
  `display_order`; label default "Sesuai foto katalog" → spesifik per grup.
- 2026-10-04 — Seeder: katalog 704 produk (611 custom, 93 stock / 349 SKU, stok awal 6.969 pcs), 17 grup / 88 opsi;
  seeder inventory dibatasi ke produk ber-stok (sebelumnya memberi stok semu 14.517 ke produk custom); HRIS:
  tanggal masuk direktur digeser (trigger saldo cuti menolak tahun < 2020).
