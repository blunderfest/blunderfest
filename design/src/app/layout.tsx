import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Open_Sans } from "next/font/google";
import "./globals.css";

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-open-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Blunderfest — analyse chess together",
  description:
    "Collaborative chess analysis: shared board, live variation tree, comments, presence and engine eval. No accounts, just a 5-letter room code.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={openSans.variable}>
      <body className="min-h-full bg-void text-ink antialiased">{children}</body>
    </html>
  );
}
