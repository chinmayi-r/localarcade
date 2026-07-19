import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Local Arena — Configuration Finder",
  description: "Match local-model artifacts, runtimes and settings to your hardware and task with visible evidence and uncertainty.",
  openGraph: {
    title: "Local Arena",
    description: "Find what runs here.",
    images: [{ url: "/og-forest.png", width: 1672, height: 941, alt: "Local Arena sprawling configuration field" }],
  },
  twitter: { card: "summary_large_image", images: ["/og-forest.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Script src="/design-system/constellation.js" strategy="afterInteractive" />{children}</body></html>;
}
