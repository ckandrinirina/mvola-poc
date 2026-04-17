import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MVola Withdrawal Demo",
  description: "Demo UI for MVola payout integration",
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
