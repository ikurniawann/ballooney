// EPIC-047 Fase 1C — sub-step 1 sub-step kasir terverifikasi end-to-end
// (lihat laporan task: jual M-Hitam 35→34, void 34→35, 15 SKU lain utuh)
// tanpa perlu perubahan kode. Test ini membuktikan bagian murni
// `claimMerchandiseStock`/`aggregateByProduct` (tidak diekspor terpisah,
// diuji lewat perilaku publiknya): item ber-`sku_id` → klaim per SKU lewat
// `pos_sell_merchandise_sku_stock`; item tanpa `sku_id` → klaim per produk
// lewat `pos_sell_merchandise_stock`; baris dengan product_id+sku_id yang
// sama digabung jadi satu panggilan RPC (qty dijumlah).
import { describe, expect, it, vi } from "vitest";
import { claimMerchandiseStock } from "./merchandise-stock";
import type { DbClient } from "@/lib/pg/types";

type RpcCall = { name: string; params: Record<string, unknown> };

function fakeDb(rpcResult: { data: unknown; error: unknown }) {
  const calls: RpcCall[] = [];
  const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
    calls.push({ name, params });
    return rpcResult;
  });
  return { db: { rpc } as unknown as DbClient, calls };
}

describe("claimMerchandiseStock — pengelompokan klaim (EPIC-047 Fase 1C)", () => {
  it("item ber-sku_id → panggil RPC per-SKU pos_sell_merchandise_sku_stock", async () => {
    const { db, calls } = fakeDb({ data: { success: true }, error: null });

    const result = await claimMerchandiseStock(db, [
      { product_id: "product-1", sku_id: "sku-m-hitam", quantity: 1 },
    ]);

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("pos_sell_merchandise_sku_stock");
    expect(calls[0].params).toEqual({ p_sku_id: "sku-m-hitam", p_qty: 1 });
  });

  it("item tanpa sku_id → panggil RPC level produk pos_sell_merchandise_stock", async () => {
    const { db, calls } = fakeDb({ data: { success: true }, error: null });

    const result = await claimMerchandiseStock(db, [
      { product_id: "product-2", quantity: 2 },
    ]);

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("pos_sell_merchandise_stock");
    expect(calls[0].params).toEqual({ p_product_id: "product-2", p_qty: 2 });
  });

  it("dua baris product_id+sku_id sama digabung jadi satu klaim (qty dijumlah)", async () => {
    const { db, calls } = fakeDb({ data: { success: true }, error: null });

    const result = await claimMerchandiseStock(db, [
      { product_id: "product-1", sku_id: "sku-m-hitam", quantity: 1 },
      { product_id: "product-1", sku_id: "sku-m-hitam", quantity: 2 },
    ]);

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].params).toEqual({ p_sku_id: "sku-m-hitam", p_qty: 3 });
  });

  it("sku_id berbeda pada produk yang sama tetap jadi dua klaim terpisah", async () => {
    const { db, calls } = fakeDb({ data: { success: true }, error: null });

    const result = await claimMerchandiseStock(db, [
      { product_id: "product-1", sku_id: "sku-m-hitam", quantity: 1 },
      { product_id: "product-1", sku_id: "sku-l-hitam", quantity: 1 },
    ]);

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
    const skuIds = calls.map((c) => c.params.p_sku_id).sort();
    expect(skuIds).toEqual(["sku-l-hitam", "sku-m-hitam"]);
  });

  it("baris qty 0 / product_id kosong diabaikan (bukan klaim)", async () => {
    const { db, calls } = fakeDb({ data: { success: true }, error: null });

    const result = await claimMerchandiseStock(db, [
      { product_id: "product-1", sku_id: "sku-m-hitam", quantity: 0 },
      { product_id: "", sku_id: "sku-l-hitam", quantity: 1 },
    ]);

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

// Multi-toko (stok per toko): klaim membawa toko transaksi → RPC *_at.
describe("claimMerchandiseStock — multi-toko", () => {
  it("varian + warehouseId → RPC pos_sell_merchandise_sku_stock_at dengan toko", async () => {
    const { db, calls } = fakeDb({ data: { success: true }, error: null });

    const result = await claimMerchandiseStock(
      db,
      [{ product_id: "product-1", sku_id: "sku-1", quantity: 2 }],
      { warehouseId: "toko-pvj" }
    );

    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      {
        name: "pos_sell_merchandise_sku_stock_at",
        params: { p_sku_id: "sku-1", p_warehouse_id: "toko-pvj", p_qty: 2 },
      },
    ]);
  });

  it("warehouseByProduct menang atas warehouseId (checkout multi-stall)", async () => {
    const { db, calls } = fakeDb({ data: { success: true }, error: null });

    await claimMerchandiseStock(
      db,
      [
        { product_id: "product-1", sku_id: "sku-1", quantity: 1 },
        { product_id: "product-2", sku_id: "sku-2", quantity: 1 },
      ],
      { warehouseId: "default", warehouseByProduct: new Map([["product-2", "stall-b"]]) }
    );

    const byProduct = Object.fromEntries(calls.map((c) => [c.params.p_sku_id, c.params.p_warehouse_id]));
    expect(byProduct).toEqual({ "sku-1": "default", "sku-2": "stall-b" });
  });

  it("produk tanpa varian tetap klaim level produk walau ada toko", async () => {
    const { db, calls } = fakeDb({ data: { success: true }, error: null });

    await claimMerchandiseStock(db, [{ product_id: "product-3", quantity: 1 }], {
      warehouseId: "toko-pvj",
    });

    expect(calls[0].name).toBe("pos_sell_merchandise_stock");
  });

  it("stok toko kurang → pesan menyebut sisa stok di toko ini", async () => {
    const rpc = vi.fn(async () => ({
      data: { success: false, reason: "insufficient_stock", quantity_available: 1 },
      error: null,
    }));
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { name: "Ballooney Nea" } }) }),
      }),
    }));
    const db = { rpc, from } as unknown as DbClient;

    const result = await claimMerchandiseStock(
      db,
      [{ product_id: "product-1", sku_id: "sku-1", quantity: 3 }],
      { warehouseId: "toko-pvj" }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.reason).toContain("di toko ini tinggal 1");
    }
  });
});
