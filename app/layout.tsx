import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Local Arena — Real-device tests for local AI",
  description: "Blind preference and reproducible performance data for local models on real consumer hardware.",
  openGraph: {
    title: "Local Arena",
    description: "Which local model actually works on your machine?",
    images: [{ url: "/og.png", width: 1660, height: 948, alt: "Local Arena real-device model comparison matrix" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
