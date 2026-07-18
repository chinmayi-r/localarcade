import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Local Arena — Find what runs here",
  description: "A rough top five local-model configurations for your hardware and task, with visible evidence and uncertainty.",
  openGraph: {
    title: "Local Arena",
    description: "Find what runs here.",
    images: [{ url: "/og-v2.png", width: 1664, height: 928, alt: "Local Arena orbital compute atlas" }],
  },
  twitter: { card: "summary_large_image", images: ["/og-v2.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
