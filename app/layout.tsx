import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gardening Whisperer",
  description: "Voice-first AI gardening assistant",
  manifest: "/manifest.json",
  themeColor: "#22c55e",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-garden-50">
        {children}
      </body>
    </html>
  );
}
