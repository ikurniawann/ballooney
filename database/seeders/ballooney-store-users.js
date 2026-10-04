#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- seeder Node CommonJS, sama seperti seeder lain */
/**
 * Seeder: akun login lokasi Ballooney (EPIC-052). Saat ini hanya satu lokasi —
 * Toko & Workshop Gading Serpong (BALLOONEY-HQ):
 *
 *   gudang@ballooney.co.id       Admin Gudang & Aset   Warehouse Admin
 *   manager.gs@ballooney.co.id   Operations Manager    POS Supervisor
 *   kasir.gs@ballooney.co.id     Kasir                 POS Cashier
 *   cs@ballooney.co.id           Admin Order & CS      POS Cashier (input order WhatsApp)
 *
 * Toko baru nanti cukup menambah baris manager.<toko>/kasir.<toko> di ACCOUNTS.
 *
 * Tiap akun ber-scope CABANG (business_scope = 'branch') dan ditempatkan di
 * stall tokonya (user_warehouses + default_warehouse_id): kasir hanya menjual
 * dari tokonya, Stok per Toko hanya bisa dikoreksi untuk tokonya, transfer
 * hanya bisa dikirim dari / diterima di tokonya. Akun ditautkan ke karyawan
 * HRIS (ballooney-demo-hris.js) supaya nama & data kepegawaian nyambung.
 *
 * PASSWORD DEV: BALLOONEY_STORE_PASSWORD=<password> menyamakan password SEMUA akun
 * (baru maupun lama) — hanya untuk lingkungan dev/demo.
 *
 * PASSWORD: dibuat acak saat akun DIBUAT dan hanya dicetak sekali di output
 * (tidak disimpan di repo). Menjalankan ulang tidak mengubah password akun yang
 * sudah ada, kecuali dengan --reset-passwords. Tulis daftar ke file dengan
 * BALLOONEY_ACCOUNTS_OUT=/path/file.md (simpan di luar repo, chmod 600).
 *
 * Usage:
 *   node database/seeders/ballooney-store-users.js
 *   node database/seeders/ballooney-store-users.js --reset-passwords
 *   npm run db:seed:ballooney-store-users
 */

const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { runSeeder } = require("./lib/ballooney-demo");

const RESET = process.argv.includes("--reset-passwords");
/** Password tetap untuk dev/demo (opsional) — menimpa password semua akun. */
const FIXED_PASSWORD = (process.env.BALLOONEY_STORE_PASSWORD || "").trim() || null;

/** [kode cabang, slug email, [peran, role, nip karyawan]...] */
const ACCOUNTS = [
  // Admin gudang memakai role Warehouse Admin: Stok per Toko ada di Items → Produk →
  // Persediaan, ditambah penerimaan barang (GRN) dari supplier balon, helium, & bunga.
  { branch: "BALLOONEY-HQ", email: "gudang@ballooney.co.id", title: "Admin Gudang & Aset", role: "warehouse_admin", nip: "BLN-1012" },
  { branch: "BALLOONEY-HQ", email: "manager.gs@ballooney.co.id", title: "Operations Manager", role: "pos_supervisor", nip: "BLN-1002" },
  { branch: "BALLOONEY-HQ", email: "kasir.gs@ballooney.co.id", title: "Kasir", role: "pos", nip: "BLN-1003" },
  // Admin order WhatsApp mencatat pesanan custom & DP lewat kasir yang sama.
  { branch: "BALLOONEY-HQ", email: "cs@ballooney.co.id", title: "Admin Order & CS", role: "pos", nip: "BLN-1004" },
];

/** Password acak mudah diketik: Ballooney-xxxx-xxxx (tanpa karakter mirip 0/O, 1/l). */
function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = (n) =>
    Array.from(crypto.randomBytes(n), (b) => alphabet[b % alphabet.length]).join("");
  return `Ballooney-${pick(4)}-${pick(4)}`;
}

async function locationOf(c, branchCode) {
  const { rows } = await c.query(
    `SELECT b.id AS branch_id, b.name AS branch_name, c.id AS company_id, c.holding_id,
            w.id AS warehouse_id, w.name AS warehouse_name
     FROM configuration.branches b
     JOIN configuration.companies c ON c.id = b.company_id
     JOIN configuration.warehouses w ON w.branch_id = b.id AND w.is_active AND w.is_default
     WHERE b.code = $1 AND b.is_active
     LIMIT 1`,
    [branchCode]
  );
  if (!rows[0]) throw new Error(`Cabang ${branchCode} belum ada — jalankan ballooney-structure dulu`);
  return rows[0];
}

runSeeder("Seeding akun login per toko", async (c) => {
  const out = [];
  for (const acc of ACCOUNTS) {
    const loc = await locationOf(c, acc.branch);
    const { rows: emp } = await c.query(
      `SELECT id, full_name FROM hris.employees WHERE nip = $1 LIMIT 1`,
      [acc.nip]
    );
    const person = emp[0]?.full_name ?? null;
    const fullName = person ? `${person} — ${acc.title}` : `${acc.title} ${loc.branch_name}`;
    const meta = JSON.stringify({ role: acc.role, full_name: fullName });
    const appMeta = JSON.stringify({ role: acc.role });

    // auth.users — password hanya di-set saat dibuat atau --reset-passwords.
    const { rows: existing } = await c.query(`SELECT id FROM auth.users WHERE lower(email) = lower($1)`, [acc.email]);
    let userId = existing[0]?.id ?? null;
    let password = null;
    if (!userId) {
      password = FIXED_PASSWORD ?? generatePassword();
      const { rows } = await c.query(
        `INSERT INTO auth.users (email, password_hash, email_verified_at, raw_user_meta_data, raw_app_meta_data)
         VALUES ($1, $2, NOW(), $3::jsonb, $4::jsonb) RETURNING id`,
        [acc.email, await bcrypt.hash(password, 10), meta, appMeta]
      );
      userId = rows[0].id;
    } else {
      if (FIXED_PASSWORD) password = FIXED_PASSWORD;
      else if (RESET) password = generatePassword();
      await c.query(
        `UPDATE auth.users
         SET email_verified_at = COALESCE(email_verified_at, NOW()), banned_until = NULL,
             raw_user_meta_data = $2::jsonb, raw_app_meta_data = $3::jsonb, updated_at = NOW()
         WHERE id = $1`,
        [userId, meta, appMeta]
      );
      if (password) {
        await c.query(`UPDATE auth.users SET password_hash = $2 WHERE id = $1`, [
          userId,
          await bcrypt.hash(password, 10),
        ]);
      }
    }

    // Profil aplikasi: scope cabang, stall default = toko, tanpa pindah stall.
    await c.query(
      `INSERT INTO configuration.users
         (id, full_name, role, email, status, business_scope, holding_id, company_id, branch_id,
          default_warehouse_id, can_switch_stall, can_central_checkout)
       VALUES ($1, $2, $3, $4, 'active', 'branch', $5, $6, $7, $8, false, false)
       ON CONFLICT (id) DO UPDATE SET
         full_name = EXCLUDED.full_name, role = EXCLUDED.role, email = EXCLUDED.email, status = 'active',
         business_scope = 'branch', holding_id = EXCLUDED.holding_id, company_id = EXCLUDED.company_id,
         branch_id = EXCLUDED.branch_id, default_warehouse_id = EXCLUDED.default_warehouse_id,
         can_switch_stall = false, can_central_checkout = false, updated_at = NOW()`,
      [userId, fullName, acc.role, acc.email, loc.holding_id, loc.company_id, loc.branch_id, loc.warehouse_id]
    );

    // Role IAM tunggal sesuai jabatan.
    const { rows: roleRows } = await c.query(`SELECT id FROM iam.roles WHERE code = $1`, [acc.role]);
    if (!roleRows[0]) throw new Error(`Role IAM ${acc.role} tidak ada`);
    await c.query(`DELETE FROM iam.user_roles WHERE user_id = $1 AND role_id <> $2`, [userId, roleRows[0].id]);
    await c.query(
      `INSERT INTO iam.user_roles (user_id, role_id, is_primary) VALUES ($1, $2, true)
       ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = true`,
      [userId, roleRows[0].id]
    );

    // Penempatan stall: hanya toko ini.
    await c.query(
      `UPDATE configuration.user_warehouses SET is_active = false, updated_at = NOW()
       WHERE user_id = $1 AND warehouse_id <> $2`,
      [userId, loc.warehouse_id]
    );
    await c.query(
      `INSERT INTO configuration.user_warehouses (user_id, warehouse_id, is_active) VALUES ($1, $2, true)
       ON CONFLICT (user_id, warehouse_id) DO UPDATE SET is_active = true, updated_at = NOW()`,
      [userId, loc.warehouse_id]
    );

    // Tautkan ke karyawan HRIS lokasi ini.
    if (emp[0]) {
      await c.query(`UPDATE hris.employees SET user_id = NULL WHERE user_id = $1 AND id <> $2`, [userId, emp[0].id]);
      await c.query(
        `UPDATE hris.employees SET user_id = $1, is_access_app = true, updated_at = NOW() WHERE id = $2`,
        [userId, emp[0].id]
      );
    }

    out.push({ ...acc, location: loc.warehouse_name, fullName, password });
    console.log(
      `  ✓ ${acc.email.padEnd(28)} ${acc.title.padEnd(19)} ${loc.warehouse_name.padEnd(34)}` +
        (password ? ` password: ${password}` : " (password tidak diubah)")
    );
  }

  const target = process.env.BALLOONEY_ACCOUNTS_OUT;
  if (target && out.some((row) => row.password)) {
    const lines = [
      "# Akun login toko Ballooney OS",
      "",
      `Dibuat ${new Date().toISOString()} oleh database/seeders/ballooney-store-users.js. Simpan rahasia; minta tiap pemilik akun mengganti password setelah login pertama.`,
      "",
      "| Lokasi | Jabatan | Nama | Email | Password |",
      "|---|---|---|---|---|",
      ...out.map(
        (row) =>
          `| ${row.location} | ${row.title} | ${row.fullName.split(" — ")[0]} | ${row.email} | ${row.password ?? "(tidak diubah)"} |`
      ),
      "",
    ];
    fs.writeFileSync(target, lines.join("\n"), { mode: 0o600 });
    console.log(`  → daftar akun ditulis ke ${target}`);
  }

  return { akun: out.length, "password baru": out.filter((row) => row.password).length };
});
