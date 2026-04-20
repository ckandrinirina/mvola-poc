import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MVola PoC — Wallet Demo",
  description:
    "Full round-trip demo: deposit, coin-flip game, cash-out, and transaction history via MVola sandbox.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
