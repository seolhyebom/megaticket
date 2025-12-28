
import type { Metadata } from "next";
import React, { Suspense } from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RegionIndicator } from "@/components/region-indicator";
import "./globals.css";

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
      <body className="antialiased min-h-screen flex flex-col font-sans bg-background text-foreground">
        <AuthProvider>
          <SiteHeader />
          <main className="flex-1 flex flex-col">
            {children}
          </main>
          <SiteFooter />
          <Suspense fallback={null}>
            <RegionIndicator region={process.env.AWS_REGION || process.env.NEXT_PUBLIC_AWS_REGION || "ap-northeast-2"} />
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
