import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// Self-hosted by next/font, so there is no render-blocking request to Google
// and no flash of the fallback face on a phone on mobile data.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "FitPact",
  description: "A private accountability board for swim, gym and diet.",
  // This must never turn up in a search result.
  robots: { index: false, follow: false, nocache: true },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "FitPact" },
};

export const viewport: Viewport = {
  themeColor: "#0b0d0c",
  width: "device-width",
  initialScale: 1,
  // Stops iOS zooming when a tile is double-tapped quickly.
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
