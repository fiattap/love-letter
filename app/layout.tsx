import type { Metadata } from "next";
import { Cardo, Cormorant_Garamond, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import SiteNav from "@/app/components/SiteNav";
import "./globals.css";

const editorial = Cormorant_Garamond({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const body = Cardo({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Love Letter",
  description: "Write heartfelt letters with the feeling of premium stationery.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${editorial.variable} ${body.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteNav />
        <div className="flex-1">{children}</div>
        <Analytics />
      </body>
    </html>
  );
}
