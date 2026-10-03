import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  weight: ["500", "600", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "APIs & AI Skills. One home. | APIKUBO",
  description:
    "A global marketplace for APIs and AI Skills. Discover, invoke, and monetize through a unified gateway-first layer.",
  openGraph: {
    title: "APIs & AI Skills. One home. | APIKUBO",
    description:
      "A global marketplace for APIs and AI Skills. Discover, invoke, and monetize through a unified gateway-first layer.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-[#FAF8F3] text-[#1C1917] antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
