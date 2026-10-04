import { describe, expect, it } from "vitest";
import {
  addDraftLine,
  draftTotalQty,
  lineExceedsStock,
  lineStockAt,
  removeDraftLine,
  TRANSFER_STATUS_TABS,
  transferStatusBadgeClass,
  transferStatusLabel,
  updateDraftLineQty,
  validateTransferDraft,
  type TransferDraftLine,
} from "./helpers";

const kaosS: Omit<TransferDraftLine, "qty"> = {
  sku_id: "sku-s",
  sku: "KAOS-S",
  sku_name: "Kaos S",
  product_name: "Kaos Ballooney",
  stock_by_location: { hq: 10, pvj: 2 },
};

const kaosM: Omit<TransferDraftLine, "qty"> = {
  sku_id: "sku-m",
  sku: "KAOS-M",
  sku_name: "Kaos M",
  product_name: "Kaos Ballooney",
  stock_by_location: { hq: 1 },
};

describe("status helpers", () => {
  it("memiliki tab Semua + 4 status berurutan", () => {
    expect(TRANSFER_STATUS_TABS.map((tab) => tab.label)).toEqual([
      "Semua",
      "Draft",
      "Dalam pengiriman",
      "Diterima",
      "Dibatalkan",
    ]);
  });

  it("memberi label & warna badge per status", () => {
    expect(transferStatusLabel("sent")).toBe("Dalam pengiriman");
    expect(transferStatusLabel("xyz")).toBe("xyz");
    expect(transferStatusBadgeClass("received")).toContain("green");
    expect(transferStatusBadgeClass("cancelled")).toContain("red");
    expect(transferStatusBadgeClass("xyz")).toContain("gray");
  });
});

describe("draft lines", () => {
  it("menambah baris baru dengan qty 1 lalu menggabungkan varian yang sama", () => {
    let lines = addDraftLine([], kaosS);
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(1);
    lines = addDraftLine(lines, kaosS);
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(2);
    lines = addDraftLine(lines, kaosM);
    expect(lines).toHaveLength(2);
    expect(draftTotalQty(lines)).toBe(3);
  });

  it("mengubah qty (dibulatkan ke bawah, minimal 0) dan menghapus baris", () => {
    let lines = addDraftLine([], kaosS);
    lines = updateDraftLineQty(lines, "sku-s", 4.7);
    expect(lines[0].qty).toBe(4);
    lines = updateDraftLineQty(lines, "sku-s", -3);
    expect(lines[0].qty).toBe(0);
    lines = updateDraftLineQty(lines, "sku-s", Number.NaN);
    expect(lines[0].qty).toBe(0);
    expect(removeDraftLine(lines, "sku-s")).toEqual([]);
  });

  it("menghitung stok di lokasi asal dan mendeteksi qty berlebih", () => {
    const line: TransferDraftLine = { ...kaosS, qty: 3 };
    expect(lineStockAt(line, "hq")).toBe(10);
    expect(lineStockAt(line, "blokm")).toBe(0);
    expect(lineStockAt(line, "")).toBe(0);
    expect(lineExceedsStock(line, "hq")).toBe(false);
    expect(lineExceedsStock(line, "pvj")).toBe(true);
    expect(lineExceedsStock(line, "")).toBe(false);
  });
});

describe("validateTransferDraft", () => {
  const lines: TransferDraftLine[] = [{ ...kaosS, qty: 2 }];

  it("lolos untuk input valid", () => {
    expect(validateTransferDraft({ fromId: "hq", toId: "pvj", lines })).toBeNull();
  });

  it("menolak lokasi kosong / sama", () => {
    expect(validateTransferDraft({ fromId: "", toId: "pvj", lines })).toMatch(/asal/);
    expect(validateTransferDraft({ fromId: "hq", toId: "", lines })).toMatch(/tujuan/);
    expect(validateTransferDraft({ fromId: "hq", toId: "hq", lines })).toMatch(/tidak boleh sama/);
  });

  it("menolak tanpa barang, qty 0, atau melebihi stok asal", () => {
    expect(validateTransferDraft({ fromId: "hq", toId: "pvj", lines: [] })).toMatch(/minimal satu/);
    expect(
      validateTransferDraft({ fromId: "hq", toId: "pvj", lines: [{ ...kaosS, qty: 0 }] })
    ).toMatch(/lebih dari 0/);
    expect(
      validateTransferDraft({ fromId: "pvj", toId: "hq", lines: [{ ...kaosS, qty: 5 }] })
    ).toMatch(/melebihi stok/);
  });
});
