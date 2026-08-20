import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Work_Sans } from "next/font/google";
import "./globals.css";

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-work",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "VOXLY Experience — A new way to live football",
  description:
    "Step inside the game. Feel the pressure, emotion and adrenaline — then talk with Messi live.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${workSans.variable} ${instrumentSerif.variable}`}>
      <body className={`${workSans.className} min-h-screen antialiased`}>{children}</body>
    </html>
  );
}
