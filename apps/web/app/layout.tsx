
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import React, { Suspense } from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RegionIndicator } from "@/components/region-indicator";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "MegaTicket",
  description: "MegaTicket - Your gateway to premium performances",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        suppressHydrationWarning
        className={`${inter.variable} antialiased min-h-screen flex flex-col font-sans bg-background text-foreground`}
      >
        {/* 런타임 Config - 다른 스크립트보다 먼저 로드 */}
        <Script src="/config.js" strategy="beforeInteractive" />
        <AuthProvider>
          <SiteHeader />
          <main className="flex-1 flex flex-col">
            {children}
          </main>
          <SiteFooter />
          <Suspense fallback={null}>
            <RegionIndicator />
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
