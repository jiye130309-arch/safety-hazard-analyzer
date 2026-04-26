import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Construction Safety Hazard Analyzer",
  description: "Upload a construction image and detect safety hazards with GPT-4o."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
