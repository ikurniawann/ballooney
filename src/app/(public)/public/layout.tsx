import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hubungi Ballooney",
  description: "Kirim permintaan pesanan custom, pembelian korporat/grosir, atau kerja sama ke Ballooney.",
};

export default function PublicFormLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
