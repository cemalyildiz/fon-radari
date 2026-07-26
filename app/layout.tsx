import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fon Radarı | Güncel Ulusal ve Uluslararası Proje Çağrıları",
  description:
    "TÜBİTAK, EUREKA, Eurostars, Horizon Europe, LIFE ve EIC proje çağrılarını tarih, destek türü, bütçe ve başvuru koşullarıyla keşfedin.",
  metadataBase: new URL("https://cemalyildiz.github.io/fon-radari/"),
  openGraph: {
    title: "Fon Radarı",
    description: "TÜBİTAK, EUREKA, Eurostars ve Avrupa fon çağrılarını tek ekranda keşfedin.",
    type: "website",
    images: [{ url: "og.png", width: 1200, height: 630, alt: "Fon Radarı" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fon Radarı",
    description: "TÜBİTAK, EUREKA, Eurostars ve Avrupa fon çağrılarını tek ekranda keşfedin.",
    images: ["og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#071a2b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
