import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Watermark Remover",
  description: "Remove watermarks from PDF files easily. Free, private, and works in your browser.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950">
        {children}
      </body>
    </html>
  );
}
