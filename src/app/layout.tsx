import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { StoreProvider } from "@/components/store/store-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "HomeNest Kitchen",
    template: "%s | HomeNest Kitchen",
  },
  description: "Premium home & kitchen products for the modern lifestyle",
  openGraph: {
    type: "website",
    siteName: "HomeNest Kitchen",
    title: "HomeNest Kitchen",
    description: "Premium home & kitchen products for the modern lifestyle",
    url: siteUrl,
    // Self-hosted branded card (session-6 S6-3); metadataBase resolves the
    // root-relative path to an absolute URL for crawlers.
    images: [{ url: "/images/og-default.png", width: 1200, height: 630, alt: "HomeNest Kitchen" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HomeNest Kitchen",
    description: "Premium home & kitchen products for the modern lifestyle",
    images: ["/images/og-default.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${playfair.variable} font-sans`}>
        {/* The Toaster wraps children so every client island can call
            useToast(); the viewport portals toasts above everything. */}
        <StoreProvider>
          <Toaster>{children}</Toaster>
        </StoreProvider>
      </body>
    </html>
  );
}
