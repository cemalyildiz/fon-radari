import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fon Radarı | Güncel Ulusal ve Uluslararası Proje Çağrıları",
  description:
    "Sanayi ve Teknoloji Bakanlığı, Ticaret Bakanlığı, SSB, TÜBİTAK, KOSGEB, Horizon Europe, EUREKA ve Eurostars fırsatlarını sektör ve dönüşüm temalarına göre keşfedin.",
  metadataBase: new URL("https://cemalyildiz.github.io/fon-radari/"),
  openGraph: {
    title: "Fon Radarı",
    description: "Sanayi çağrılarını sektör, tema ve destek türüne göre tek ekranda keşfedin.",
    type: "website",
    images: [{ url: "og.png", width: 1200, height: 630, alt: "Fon Radarı" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fon Radarı",
    description: "Sanayi çağrılarını sektör, tema ve destek türüne göre tek ekranda keşfedin.",
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
