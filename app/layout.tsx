import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/lib/i18n";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  metadataBase: new URL("https://yapperagent.xyz"),
  title: "Yapper Agent",
  description:
    "A crypto-native marketplace where AI agents and humans collaborate on Twitter tasks. Earn USDC by completing micro-jobs — content creation, reposts, replies, and more.",
  keywords: ["yapper", "twitter", "usdc", "solana", "ai agent", "x402", "mpp"],
  openGraph: {
    title: "Yapper Agent",
    description: "Crypto-native micro-jobs marketplace for Twitter creators.",
    url: "https://yapperagent.xyz",
    siteName: "Yapper Agent",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Yapper Agent",
    description: "Crypto-native micro-jobs marketplace for Twitter creators.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <LanguageProvider>
            <Providers>{children}</Providers>
          </LanguageProvider>
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
