import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "E-Rechnungs-Lotse",
  description: "E-Rechnungen empfangen, prüfen, verstehen und sicher archivieren.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
