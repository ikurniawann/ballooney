/**
 * EPIC-054 — personalisasi untuk merchandise ber-SKU (Ballooney).
 *
 * Sebelumnya produk merchandise ber-varian langsung masuk keranjang begitu SKU
 * dipilih, sehingga grup modifier (isi helium, pemberat, tulisan custom, …)
 * tidak pernah ditawarkan. Alurnya kini: pilih SKU (stok per varian) → bila
 * produk punya grup personalisasi, popup kustomisasi dibuka dengan harga dasar
 * = harga SKU dan varian harga produk (pos_product_variants) disembunyikan,
 * karena "varian" merchandise sudah diwakili SKU-nya.
 */

import type { PricedProduct } from "@/lib/pos/customization-price";

export type SkuRef = {
  id: string;
  sku: string;
  name: string;
  price_override?: number | string | null;
};

type ProductWithModifiers = PricedProduct & { id: string; name: string };

/** Produk punya minimal satu grup personalisasi aktif? */
export function hasPersonalization(product: { modifiers?: PricedProduct["modifiers"] }): boolean {
  return (product.modifiers ?? []).some((group) => (group.modifier_group?.modifiers ?? []).length > 0);
}

/** Harga satuan SKU: override SKU bila diisi, selain itu harga produk. */
export function skuUnitPrice(product: { base_price: PricedProduct["base_price"] }, sku: SkuRef): number {
  const override = sku.price_override;
  const value = override === null || override === undefined || override === "" ? product.base_price : override;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Salinan produk untuk popup kustomisasi: harga dasar = harga SKU, tanpa
 * varian harga produk (SKU sudah menentukan varian), modifier tetap.
 */
export function productForSkuPersonalization<T extends ProductWithModifiers>(product: T, sku: SkuRef): T {
  return { ...product, base_price: skuUnitPrice(product, sku), variants: [] };
}

/**
 * Id baris keranjang: SKU + opsi + catatan berbeda = baris berbeda (dua balon
 * "Gold" dengan tulisan nama berbeda tidak boleh digabung jadi qty 2).
 */
export function skuPersonalizedLineId(productId: string, skuId: string, modifierNames: string[], notes = ""): string {
  const note = notes.trim();
  return `${productId}::sku:${skuId}::${modifierNames.join(",")}${note ? `::${note}` : ""}`;
}

type ActiveFlag = { is_active?: boolean | null };
type OptionRows = {
  variants?: ActiveFlag[] | null;
  modifiers?: Array<{ modifier_group?: (ActiveFlag & { modifiers?: ActiveFlag[] | null }) | null }> | null;
};

/**
 * Daftar jual kasir hanya menampilkan varian harga, grup, dan opsi yang aktif.
 * Seeder/admin menonaktifkan opsi (bukan menghapus — riwayat order menyimpan
 * nama opsi), sedangkan relasi bersarang API ikut membawa baris nonaktif.
 */
export function withActiveCustomizationOptions<T extends OptionRows>(product: T): T {
  const active = (row: ActiveFlag | null | undefined) => Boolean(row) && row!.is_active !== false;
  return {
    ...product,
    ...(Array.isArray(product.variants) ? { variants: product.variants.filter(active) } : {}),
    ...(Array.isArray(product.modifiers)
      ? {
          modifiers: product.modifiers
            .filter((link) => active(link.modifier_group))
            .map((link) => ({
              ...link,
              modifier_group: {
                ...link.modifier_group,
                modifiers: (link.modifier_group?.modifiers ?? []).filter(active),
              },
            })),
        }
      : {}),
  };
}
