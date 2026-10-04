"""Bangkitkan database/seeders/data/ballooney-catalog.json dari katalog publik
ballooney.co.id (WooCommerce Store API) + foto produk di public/products/ballooney.

Data dari situs: nama, harga jual, kategori, foto (704 produk, 2026-10-04).
ASUMSI demo (situs tidak mencantumkannya): HPP, stok awal, barcode internal
(prefiks GS1 in-store 200), varian ber-stok untuk balon siap jual, harga opsi
personalisasi (di situs semua opsi tampil "Rp" tanpa nilai).

Pakai:
  python3 database/seeders/data/build_ballooney_catalog.py            # pakai cache
  python3 database/seeders/data/build_ballooney_catalog.py --refresh  # unduh ulang API + foto
"""
import html
import io
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUT = os.path.join(ROOT, "database", "seeders", "data", "ballooney-catalog.json")
IMG_DIR = os.path.join(ROOT, "public", "products", "ballooney")
CACHE = os.environ.get("BALLOONEY_API_CACHE", "/tmp/ballooney-store-api.json")
API = "https://ballooney.co.id/wp-json/wc/store/v1/products?per_page=100&page={}"
UA = {"User-Agent": "Mozilla/5.0 (BallooneyOS catalog import)"}

# ── Kategori POS (kode, nama, deskripsi, mode, kategori situs berurutan prioritas)
# mode: stock = barang siap jual ber-stok per varian; custom = dibuat sesuai pesanan.
CATEGORIES = [
    ("FB", "Balon Foil", "Balon foil huruf, angka, bintang, love, karakter — siap jual, bisa isi helium", "stock", ["Foil Balloons"]),
    ("LX", "Balon Latex & Helium", "Balon latex polos, chrome, marble, bubble — siap jual per warna", "stock", ["Balloon Only"]),
    ("BQ", "Hand Bouquet", "Buket bunga & balon, personalisasi warna, boneka, wrapping, pita, kartu", "custom", ["Hand Bouquet"]),
    ("FA", "Rangkaian Bunga", "Flower arrangement, standing flower, rose bear & bunny", "custom",
     ["Small Flower Arrangement", "Big Flower Arrangement", "Mini loop arrangement", "Standing Flower", "Rose Bear & Bunny Baloon"]),
    ("GF", "Balloon Gift & Box", "Balloon box, parcel, teddy & balloon, money edition", "custom",
     ["Balloon Box", "Balloon Gift & Stuffed", "Bear Teddy and Balloon", "Mini Parcel", "Big Parcel", "Money Edition"]),
    ("KB", "Konfigurasi Balon", "Konfigurasi balon kecil–giant, paket latex & deko, flower balloon twist", "custom",
     ["Small Balloon Configuration", "Big Balloon Configuration", "Giant Configuration", "Latex & Deco Package", "Flower Balloon Twist"]),
    ("TW", "Balloon Art & Twisting", "Balloon art karakter, pop the cake, pull the money", "custom", ["Twisting Balloon"]),
    ("PP", "Party Pack & Backdrop", "Party pack, backdrop, flatbase, signage, perlengkapan dekor", "custom",
     ["Party Pack", "Decoration Stuff", "Signage"]),
    ("DS", "Paket Dekorasi", "Paket dekorasi acara: simple decor, decoration set, flower decoration, gender reveal, grand opening", "custom",
     ["Simple Decoration Pricelist", "Decoration Set Pricelist", "Flower Decoration", "Gender Reveal Pricelist", "Grand Opening"]),
    ("TH", "Hadiah Tema", "Gift tema love, graduation, baby, birthday, mother's day, padel", "custom",
     ["Love Theme", "Valentine's Day", "Graduation Theme", "Baby Theme Gift", "Baby Theme", "Birthday Theme", "Mother's Special Day", "Padel Express"]),
    ("SS", "Koleksi Musiman", "Koleksi Imlek, Natal, Ramadan, Halloween, 17 Agustus", "custom",
     ["Chinese New Year Collection", "Christmas Edition", "Ramadan Special", "Halloween", "Independence Day Theme"]),
]

# ── Grup personalisasi (pos_modifier_groups bersama). [nama opsi, tambahan harga]
# Opsi pertama grup wajib = "<hal> sesuai foto" → pilihan default kasir = seperti di foto katalog.
# Namanya spesifik per grup karena keranjang & struk hanya menampilkan nama opsi (tanpa nama grup).
BALLOON_COLORS = ["Light Blue", "Dark Blue", "Light Pink", "Dark Pink", "Gold", "Silver", "Purple", "Green", "Red"]
MODIFIER_GROUPS = [
    # kode, nama (unik — seeder mencocokkan grup per nama), min, max, opsi
    ("HELIUM_S", "Isi Helium — balon kecil", 1, 1, [["Tanpa helium (isi udara)", 0], ["Isi helium", 3000]]),
    ("HELIUM_M", "Isi Helium — balon sedang", 1, 1, [["Tanpa helium (isi udara)", 0], ["Isi helium", 15000]]),
    ("HELIUM_L", "Isi Helium — balon besar", 1, 1, [["Tanpa helium (isi udara)", 0], ["Isi helium", 60000]]),
    ("PEMBERAT", "Tali & Pemberat", 0, 1, [["Pemberat balon standar", 5000], ["Pemberat box custom nama", 25000], ["Tali pita satin", 3000]]),
    ("BENTUK_FOIL", "Bentuk Balon Foil", 1, 1, [["Bentuk sesuai foto", 0], ["Star Foil (bintang)", 0], ["Love Foil (hati)", 0], ["Round Foil (bulat)", 0]]),
    ("WARNA_BALON", "Warna Balon", 1, 1, [["Warna balon sesuai foto", 0]] + [[c, 0] for c in BALLOON_COLORS] + [["Rose Gold", 5000], ["Chrome Gold", 5000]]),
    ("BONEKA", "Pilihan Boneka", 1, 1, [["Boneka sesuai foto", 0], ["Tanpa boneka", 0], ["White Bear", 35000], ["Graduation Bear", 45000], ["Love Bear", 40000]]),
    ("WRAPPING", "Warna Wrapping", 1, 1, [["Wrapping sesuai foto", 0]] + [[f"{c} Theme", 0] for c in
        ["Light Pink", "Light Blue", "White", "Black", "Gold", "Purple", "Red", "Blush / Cream", "Silver"]]),
    ("PITA", "Warna Pita", 1, 1, [["Pita sesuai foto", 0]] + [[c, 0] for c in ["Merah", "Putih", "Pink", "Gold", "Silver", "Hitam", "Navy", "Ungu"]]),
    ("KARTU", "Kartu Ucapan", 1, 1, [["Kartu ucapan standar (gratis)", 0], ["Kartu premium + amplop", 15000], ["Tanpa kartu", 0]]),
    ("TAMBAHAN", "Tambahan Hadiah", 0, 3, [["Coklat Ferrero 3 pcs", 45000], ["Lampu LED fairy", 25000],
        ["Tulisan custom di balon", 35000], ["Mawar asli 3 tangkai", 60000], ["Mini balloon jar", 50000]]),
    ("WARNA_BUNGA", "Warna Bunga Dominan", 1, 1, [["Bunga sesuai foto", 0]] + [[c, 0] for c in ["Merah", "Pink", "Putih", "Pastel Mix", "Ungu", "Peach", "Kuning"]]),
    ("UANG", "Rangkai Uang (uang dari pelanggan)", 1, 1, [["Tanpa rangkai uang", 0], ["Rangkai s.d. 20 lembar", 50000], ["Rangkai s.d. 50 lembar", 100000]]),
    ("TEMA", "Tema Warna", 1, 1, [["Tema sesuai foto", 0]] + [[c, 0] for c in
        ["Pastel", "Merah – Putih", "Gold – Putih", "Pink – Rose Gold", "Biru – Silver", "Hitam – Gold", "Rainbow", "Custom sesuai tema acara"]]),
    ("TULISAN", "Tulisan / Nama Custom", 0, 1, [["Sticker vinyl nama", 50000], ["Huruf foil nama (1 set)", 120000], ["Neon box acrylic", 350000]]),
    ("UPGRADE", "Upgrade Dekorasi", 0, 3, [["Tambah balon chrome", 250000], ["Tambah bunga artificial", 400000],
        ["Lampu tumblr", 150000], ["Area foto + karpet", 300000]]),
    ("KIRIM", "Pengiriman & Pemasangan", 1, 1, [["Ambil di toko", 0], ["Antar area Tangerang", 75000],
        ["Antar Jakarta", 150000], ["Antar & pasang di venue", 350000]]),
]

GIFT = ["BENTUK_FOIL", "WARNA_BALON", "BONEKA", "WRAPPING", "PITA", "KARTU", "TAMBAHAN", "KIRIM"]
DECOR = ["TEMA", "TULISAN", "UPGRADE", "KIRIM"]
GROUPS_BY_CATEGORY = {
    "BQ": GIFT,
    "FA": ["WARNA_BUNGA", "PITA", "KARTU", "TAMBAHAN", "KIRIM"],
    "GF": GIFT,
    "KB": ["TEMA", "TULISAN", "KIRIM"],
    "TW": ["TEMA", "TULISAN", "KIRIM"],
    "PP": DECOR,
    "DS": DECOR,
    "TH": GIFT,
    "SS": GIFT,
}

STD_LATEX = ["Merah", "Putih", "Hitam", "Pink", "Baby Pink", "Biru Muda", "Biru Tua", "Kuning", "Hijau", "Ungu", "Peach", "Silver"]
FOIL_METAL = ["Gold", "Silver", "Rose Gold"]


def stock_variants(name):
    """Sumbu varian ber-stok untuk barang siap jual → list dict opsi."""
    n = name.lower()
    if n.startswith("alphabet balloon"):
        return [{"Huruf": ch, "Warna": w} for w in FOIL_METAL for ch in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"]
    if n.startswith("number balloon"):
        return [{"Angka": str(d), "Warna": w} for w in FOIL_METAL for d in range(10)]
    if n.startswith("jumbo star foil"):
        return [{"Warna": w} for w in ["Gold", "Silver", "Rose Gold", "Red"]]
    if n in ("heart / love foil balloon", "star foil balloon", "round foil balloon"):
        return [{"Warna": w} for w in BALLOON_COLORS + ["Rose Gold"]]
    if "chrome" in n and "latex" in n:
        return [{"Warna": w} for w in ["Gold", "Silver", "Rose Gold", "Chrome Blue", "Chrome Pink", "Chrome Purple"]]
    if n.startswith("heart shaped"):
        return [{"Warna": w} for w in ["Merah", "Pink", "Putih", "Baby Pink"]]
    if n.startswith("marble balloon"):
        return [{"Motif": w} for w in ["Pink Marble", "Blue Marble", "Rainbow Marble"]]
    if re.match(r"(mini balloon|reguler balloon|latex 18|latex 36)", n):
        return [{"Warna": w} for w in STD_LATEX]
    return []


def helium_group(name, price):
    n = name.lower()
    if re.search(r"jumbo|36|100 cm|giant|bubble|walkie", n) or price >= 100000:
        return "HELIUM_L"
    if re.search(r"80 cm|18", n) or price >= 25000:
        return "HELIUM_M"
    return "HELIUM_S"


def value_code(value):
    """Kode singkat nilai varian: "Gold" → GOLD, "Light Blue" → LBLU, "Chrome Pink" → CPIN."""
    words = re.findall(r"[A-Z0-9]+", value.upper())
    return ("".join(w[0] for w in words[:-1]) + words[-1][:3]) if len(words) > 1 else words[0][:4]


def ean13(seq):
    base = f"200{seq:09d}"
    s = sum(int(d) * (3 if i % 2 else 1) for i, d in enumerate(base))
    return base + str((10 - s % 10) % 10)


def round_k(v, step=5000):
    return int(round(v / step) * step)


def fetch_api(refresh):
    if os.path.exists(CACHE) and not refresh:
        return json.load(open(CACHE))
    out = []
    for page in range(1, 20):
        req = urllib.request.Request(API.format(page), headers=UA)
        batch = json.load(urllib.request.urlopen(req, timeout=60))
        if not batch:
            break
        out += batch
    json.dump(out, open(CACHE, "w"))
    return out


def save_image(url, path, refresh):
    if os.path.exists(path) and not refresh:
        return True
    try:
        from PIL import Image
        req = urllib.request.Request(url, headers=UA)
        im = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=60).read())).convert("RGB")
        im.thumbnail((640, 640))
        im.save(path, "WEBP", quality=72, method=6)
        return True
    except Exception as exc:  # foto gagal → produk tetap ada, tanpa foto
        print("  ! foto gagal", url, exc, file=sys.stderr)
        return False


def main():
    refresh = "--refresh" in sys.argv
    raw = fetch_api(refresh)
    os.makedirs(IMG_DIR, exist_ok=True)
    cat_rank = {}
    for rank, (ccode, _, _, _, site_cats) in enumerate(CATEGORIES):
        for sc in site_cats:
            cat_rank[sc] = (rank, ccode)
    mode_by_code = {c[0]: c[3] for c in CATEGORIES}
    counters = {c[0]: 0 for c in CATEGORIES}
    seen_names = {}
    products = []
    barcode_seq = 1
    for p in raw:
        site_cats = [html.unescape(c["name"]) for c in p["categories"]]
        ranked = sorted(cat_rank[c] for c in site_cats if c in cat_rank)
        if not ranked:
            print("  ! lewati (kategori tak dikenal):", p["name"], site_cats, file=sys.stderr)
            continue
        ccode = ranked[0][1]
        name = html.unescape(p["name"]).replace("″", '"').strip()
        key = name.lower()
        if key in seen_names:  # nama kembar di situs → beri penanda kategori
            seen_names[key] += 1
            name = f"{name} ({seen_names[key]})"
        else:
            seen_names[key] = 1
        counters[ccode] += 1
        sku = f"BLN-{ccode}-{counters[ccode]:03d}"
        price = int(p["prices"]["price"] or 0)
        regular = int(p["prices"]["regular_price"] or 0)
        mode = mode_by_code[ccode]
        cost = round_k(price * (0.5 if mode == "stock" else 0.42), 500 if price < 50000 else 5000)
        desc_site = re.sub(r"<[^>]+>", " ", html.unescape(p.get("short_description") or p.get("description") or ""))
        desc_site = re.sub(r"\s+", " ", desc_site).strip()[:300]
        themes = [c for c in site_cats if cat_rank.get(c, (0, ccode))[1] != ccode]
        desc = desc_site or (f"{name} — " + ("siap jual, stok per varian." if mode == "stock" else "dibuat sesuai pesanan, bisa dipersonalisasi."))
        image = None
        if p.get("images"):
            path = os.path.join(IMG_DIR, sku.lower() + ".webp")
            if save_image(p["images"][0]["src"], path, refresh):
                image = f"/products/ballooney/{sku.lower()}.webp"
        variants = []
        modifiers = []
        product_variants = []
        if mode == "stock":
            for opts in stock_variants(name):
                vcode = "-".join(value_code(v) for v in opts.values())
                variants.append({
                    "sku": f"{sku}-{vcode}",
                    "name": " / ".join(opts.values()),
                    "options": opts,
                    "barcode": ean13(barcode_seq),
                })
                barcode_seq += 1
            modifiers = [helium_group(name, price), "PEMBERAT"]
        else:
            modifiers = list(GROUPS_BY_CATEGORY[ccode])
            if ccode == "GF" and "money" in " ".join(site_cats).lower() + key:
                modifiers.insert(-1, "UANG")
            # Varian ukuran (harga bertingkat) untuk buket & rangkaian bunga.
            if ccode in ("BQ", "FA"):
                product_variants = [
                    {"group": "Ukuran", "name": "Standar (sesuai foto)", "price_adjustment": 0},
                    {"group": "Ukuran", "name": "Besar", "price_adjustment": round_k(price * 0.35)},
                    {"group": "Ukuran", "name": "Jumbo", "price_adjustment": round_k(price * 0.75)},
                ]
        products.append({
            "sku": sku,
            "name": name,
            "category": ccode,
            "mode": mode,
            "price": price,
            "compare_at_price": regular if regular > price else None,
            "cost": cost,
            "description": desc,
            "themes": themes,
            "image": image,
            "weight_gram": 50 if ccode in ("FB", "LX") else 1500,
            "barcode": ean13(barcode_seq) if not variants else None,
            "variants": variants,
            "product_variants": product_variants,
            "modifier_groups": modifiers,
            "source_url": p["permalink"],
        })
        if not variants:
            barcode_seq += 1
    all_skus = [p["sku"] for p in products] + [v["sku"] for p in products for v in p["variants"]]
    assert len(all_skus) == len(set(all_skus)), "SKU kembar"
    data = {
        "source": "https://ballooney.co.id (WooCommerce Store API), diambil 2026-10-04",
        "categories": [{"code": c[0], "name": c[1], "description": c[2], "mode": c[3]} for c in CATEGORIES],
        "modifier_groups": [{"code": g[0], "name": g[1], "min": g[2], "max": g[3],
                             "options": [{"name": o[0], "price_adjustment": o[1]} for o in g[4]]} for g in MODIFIER_GROUPS],
        "products": products,
    }
    with open(OUT, "w") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    nvar = sum(len(p["variants"]) for p in products)
    print(f"ok: {len(products)} produk, {nvar} SKU varian, {sum(1 for p in products if p['image'])} foto → {OUT}")
    for c in CATEGORIES:
        print(f"  {c[0]} {c[1]:<28} {counters[c[0]]:>4} ({c[3]})")


if __name__ == "__main__":
    main()
