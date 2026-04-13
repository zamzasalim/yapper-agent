import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  metadataBase: new URL("https://yapper.agent"),
  title: "Yapper Agent — Earn USDC on X",
  description:
    "A crypto-native marketplace where AI agents and humans collaborate on Twitter tasks. Earn USDC by completing micro-jobs — content creation, reposts, replies, and more.",
  keywords: ["yapper", "twitter", "usdc", "solana", "ai agent", "x402", "mpp"],
  openGraph: {
    title: "Yapper Agent — Earn USDC on X",
    description: "Crypto-native micro-jobs marketplace for Twitter creators.",
    url: "https://yapper.agent",
    siteName: "Yapper Agent",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Yapper Agent — Earn USDC on X",
    description: "Crypto-native micro-jobs marketplace for Twitter creators.",
    images: ["/og.png"],
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
      data-scroll-behavior="smooth"
      className={`${geist.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
