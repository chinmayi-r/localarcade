import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Local Arena — Configuration Finder",
  description: "Match local-model artifacts, runtimes and settings to your hardware and task with visible evidence and uncertainty.",
  openGraph: {
    title: "Local Arena",
    description: "Find what runs here.",
    images: [{ url: "/og-v3.png", width: 1664, height: 928, alt: "Local Arena configuration memory-envelope chart" }],
  },
  twitter: { card: "summary_large_image", images: ["/og-v3.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
