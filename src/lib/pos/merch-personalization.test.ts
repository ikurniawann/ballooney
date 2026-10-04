import { describe, expect, it } from "vitest";
import { computeCustomizationPrice } from "@/lib/pos/customization-price";
import {
  hasPersonalization,
  productForSkuPersonalization,
  skuPersonalizedLineId,
  skuUnitPrice,
  withActiveCustomizationOptions,
} from "@/lib/pos/merch-personalization";

const helium = {
  modifier_group: {
    id: "g-helium",
    name: "Isi Helium — balon kecil",
    min_selection: 1,
    max_selection: 1,
    modifiers: [
      { id: "m-udara", name: "Tanpa helium (isi udara)", price_adjustment: 0 },
      { id: "m-helium", name: "Isi helium", price_adjustment: 3000 },
    ],
  },
};

const starFoil = {
  id: "p-star",
  name: "Star Foil Balloon",
  base_price: "12000.00",
  variants: [{ id: "v-x", name: "Besar", price_adjustment: 5000 }],
  modifiers: [helium],
};

describe("hasPersonalization", () => {
  it("true bila ada grup dengan opsi", () => {
    expect(hasPersonalization(starFoil)).toBe(true);
  });

  it("false tanpa modifier atau grup kosong", () => {
    expect(hasPersonalization({ modifiers: [] })).toBe(false);
    expect(hasPersonalization({})).toBe(false);
    expect(
      hasPersonalization({ modifiers: [{ modifier_group: { name: "Kosong", modifiers: [] } }] })
    ).toBe(false);
  });
});

describe("skuUnitPrice", () => {
  it("memakai price_override SKU bila ada", () => {
    expect(skuUnitPrice(starFoil, { id: "s1", sku: "BLN-FB-007-GOLD", name: "Gold", price_override: 15000 })).toBe(15000);
  });

  it("jatuh ke harga produk (string numeric Postgres) bila override kosong", () => {
    expect(skuUnitPrice(starFoil, { id: "s1", sku: "BLN-FB-007-GOLD", name: "Gold", price_override: null })).toBe(12000);
    expect(skuUnitPrice(starFoil, { id: "s1", sku: "BLN-FB-007-GOLD", name: "Gold" })).toBe(12000);
  });
});

describe("productForSkuPersonalization", () => {
  it("harga dasar = harga SKU, varian produk dibuang, modifier tetap", () => {
    const p = productForSkuPersonalization(starFoil, { id: "s1", sku: "X", name: "Gold", price_override: 14000 });
    expect(p.base_price).toBe(14000);
    expect(p.variants).toEqual([]);
    expect(p.modifiers).toBe(starFoil.modifiers);
    expect(starFoil.variants).toHaveLength(1); // produk asli tidak diubah
  });

  it("total = harga SKU + opsi personalisasi", () => {
    const p = productForSkuPersonalization(starFoil, { id: "s1", sku: "X", name: "Gold" });
    const price = computeCustomizationPrice(p, {
      selectedVariant: null,
      selectedModifiers: { "Isi Helium — balon kecil": ["m-helium"] },
    });
    expect(price.unitPrice).toBe(15000);
    expect(price.modifierAdj).toBe(3000);
    expect(price.modifierNames).toEqual(["Isi helium"]);
  });
});

describe("skuPersonalizedLineId", () => {
  it("SKU, opsi, dan catatan berbeda menghasilkan baris berbeda", () => {
    const a = skuPersonalizedLineId("p", "s1", ["Isi helium"], "Happy Birthday Sasa");
    const b = skuPersonalizedLineId("p", "s1", ["Isi helium"], "Happy Birthday Dimas");
    const c = skuPersonalizedLineId("p", "s2", ["Isi helium"]);
    const d = skuPersonalizedLineId("p", "s1", ["Tanpa helium (isi udara)"]);
    expect(new Set([a, b, c, d]).size).toBe(4);
  });

  it("pilihan sama = id sama (qty digabung), spasi catatan diabaikan", () => {
    expect(skuPersonalizedLineId("p", "s1", ["Isi helium"], " ")).toBe(skuPersonalizedLineId("p", "s1", ["Isi helium"]));
  });
});

type Row = { id: string; is_active?: boolean };
type RowProduct = {
  id: string;
  variants: Row[];
  modifiers: Array<{ modifier_group: (Row & { modifiers: Row[] }) | null }>;
};

describe("withActiveCustomizationOptions", () => {
  it("membuang varian, grup, dan opsi nonaktif; baris tanpa flag dianggap aktif", () => {
    const product: RowProduct = {
      id: "p",
      variants: [{ id: "v1", is_active: true }, { id: "v2", is_active: false }, { id: "v3" }],
      modifiers: [
        { modifier_group: { id: "g1", is_active: true, modifiers: [{ id: "a", is_active: true }, { id: "b", is_active: false }] } },
        { modifier_group: { id: "g2", is_active: false, modifiers: [{ id: "c" }] } },
        { modifier_group: null },
      ],
    };
    const out = withActiveCustomizationOptions(product);
    expect(out.variants.map((v) => v.id)).toEqual(["v1", "v3"]);
    expect(out.modifiers.map((m) => m.modifier_group?.id)).toEqual(["g1"]);
    expect(out.modifiers[0].modifier_group?.modifiers.map((m) => m.id)).toEqual(["a"]);
    expect(product.variants).toHaveLength(3); // tidak memutasi input
  });

  it("produk tanpa relasi dibiarkan apa adanya", () => {
    const bare: { id: string; variants?: null } = { id: "x" };
    expect(withActiveCustomizationOptions(bare)).toEqual({ id: "x" });
  });
});
