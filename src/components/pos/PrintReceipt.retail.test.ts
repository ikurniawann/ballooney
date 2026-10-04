// Mode kasir retail (NEXT_PUBLIC_POS_MODE=retail): struk toko tanpa jenis
// order (TAKEAWAY) dan tanpa nomor antrian dapur.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pos/business-mode", () => ({
  IS_RETAIL_POS: true,
  RETAIL_ORDER_TYPE: "takeaway",
  RETAIL_SALE_LABEL: "Penjualan toko",
}));

const { buildReceiptHtml, buildReceiptLines } = await import("./PrintReceipt");
import type { ReceiptPayload } from "./PrintReceipt";

const retailPayload: ReceiptPayload = {
  orderNumber: "POS-20261004-0001",
  queueNumber: "001",
  orderType: "takeaway",
  table: null,
  items: [{ id: "1", productId: "p1", name: "Ballooney Nea — Black", price: 389000, quantity: 1 }],
  notes: "",
  total: 389000,
  change: 0,
  paymentMethod: "cash",
  discountAmount: 0,
  taxAmount: 0,
};

describe("struk mode retail", () => {
  it("teks thermal tanpa TAKEAWAY & ANTRIAN, nomor order tetap ada (versi singkat)", () => {
    const text = buildReceiptLines(retailPayload, "CUSTOMER").join("\n");
    expect(text).not.toContain("TAKEAWAY");
    expect(text).not.toContain("ANTRIAN");
    expect(text).toContain("Order #004-0001");
  });

  it("HTML tanpa TAKEAWAY & ANTRIAN", () => {
    const html = buildReceiptHtml(retailPayload, "CUSTOMER");
    expect(html).not.toContain("TAKEAWAY");
    expect(html).not.toContain("ANTRIAN");
  });
});
