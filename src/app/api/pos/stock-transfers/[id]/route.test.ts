import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getStockTransfer = vi.fn();
const runStockTransferAction = vi.fn();
vi.mock("@/lib/api/scope", () => ({ getApiUserScope: vi.fn(async () => ({ userId: "user-1" })) }));
const loadManageable = vi.fn(async (..._args: unknown[]): Promise<Set<string> | null> => null);

vi.mock("@/lib/api/auth", () => ({
  requirePosMenu: vi.fn(async () => ({ error: null, userId: "user-1", user: { id: "user-1" } })),
}));
vi.mock("@/lib/pos/store-stock-server", async () => {
  class StoreStockError extends Error {
    constructor(message: string, public status = 400) {
      super(message);
    }
  }
  return {
    StoreStockError,
    getStockTransfer: (...args: unknown[]) => getStockTransfer(...args),
    runStockTransferAction: (...args: unknown[]) => runStockTransferAction(...args),
  loadManageableWarehouseIds: (...args: unknown[]) => loadManageable(...args),
  canManageLocation: (m: Set<string> | null, id: string) => m === null || m.has(id),
  transferActionLocation: (action: string, t: { from_warehouse_id: string; to_warehouse_id: string }) =>
    action === "receive" ? t.to_warehouse_id : t.from_warehouse_id,
  };
});

function post(body: unknown) {
  return new NextRequest("http://localhost/api/pos/stock-transfers/t1", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: "t1" }) };
const transfer = (status: string) => ({
  id: "t1",
  status,
  from_warehouse_id: "hq",
  from_name: "Gudang Pusat",
  to_warehouse_id: "pvj",
  to_name: "Ballooney Store PVJ",
  items: [],
});

describe("POST /api/pos/stock-transfers/[id] — aksi transfer", () => {
  beforeEach(() => {
    getStockTransfer.mockReset();
    runStockTransferAction.mockReset();
    loadManageable.mockReset();
    loadManageable.mockResolvedValue(null);
  });

  it("draft → send dijalankan dengan user sesi", async () => {
    getStockTransfer.mockResolvedValue(transfer("draft"));
    const { POST } = await import("./route");
    const res = await POST(post({ action: "send" }), ctx);
    expect(res.status).toBe(200);
    expect(runStockTransferAction).toHaveBeenCalledWith("t1", "send", "user-1");
  });

  it("aksi tidak sah untuk status → 400 tanpa menyentuh stok", async () => {
    getStockTransfer.mockResolvedValue(transfer("received"));
    const { POST } = await import("./route");
    const res = await POST(post({ action: "cancel" }), ctx);
    expect(res.status).toBe(400);
    expect(runStockTransferAction).not.toHaveBeenCalled();
  });

  it("transfer tidak ada → 404", async () => {
    getStockTransfer.mockResolvedValue(null);
    const { POST } = await import("./route");
    const res = await POST(post({ action: "send" }), ctx);
    expect(res.status).toBe(404);
  });

  it("pesan stok kurang dari SQL diteruskan sebagai 400", async () => {
    getStockTransfer.mockResolvedValue(transfer("draft"));
    const { StoreStockError } = await import("@/lib/pos/store-stock-server");
    runStockTransferAction.mockRejectedValue(
      new StoreStockError("Stok Ballooney Nea Silver di lokasi asal tidak cukup untuk dikirim 9")
    );
    const { POST } = await import("./route");
    const res = await POST(post({ action: "send" }), ctx);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toContain("tidak cukup");
  });

  it("akun toko tujuan boleh menerima, tidak boleh mengirim", async () => {
    loadManageable.mockResolvedValue(new Set(["pvj"]));
    const { POST } = await import("./route");
    getStockTransfer.mockResolvedValue(transfer("draft"));
    const send = await POST(post({ action: "send" }), ctx);
    expect(send.status).toBe(403);
    expect((await send.json()).error).toContain("Gudang Pusat");
    getStockTransfer.mockResolvedValue(transfer("sent"));
    const receive = await POST(post({ action: "receive" }), ctx);
    expect(receive.status).toBe(200);
    expect(runStockTransferAction).toHaveBeenCalledTimes(1);
    expect(runStockTransferAction).toHaveBeenCalledWith("t1", "receive", "user-1");
  });

  it("akun toko lain tidak bisa melihat/menjalankan transfer", async () => {
    loadManageable.mockResolvedValue(new Set(["blokm"]));
    getStockTransfer.mockResolvedValue(transfer("sent"));
    const { POST } = await import("./route");
    const res = await POST(post({ action: "receive" }), ctx);
    expect(res.status).toBe(404);
    expect(runStockTransferAction).not.toHaveBeenCalled();
  });
});
