import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Careers | Ballooney",
  description:
    "Explore open roles and apply to join the Ballooney team.",
};

export default function CareerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
