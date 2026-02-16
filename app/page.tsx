"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { UploadZone } from "@/components/upload/UploadZone";
import { Card } from "@/components/ui/Card";
import { FileText, Shield, Zap } from "lucide-react";
import { storeFile } from "@/lib/storage/indexedDB";

export default function Home() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      await storeFile(file);
      router.push("/editor");
    } catch (error) {
      console.error("Failed to store file:", error);
      setIsUploading(false);
    }
  }, [router]);

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            <span className="text-xl font-semibold text-gray-900 dark:text-white">
              PDF Watermark Remover
            </span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Remove Watermarks from PDFs
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            Select and remove watermarks from your PDF files. Fast, free, and private.
            Your files never leave your browser for simple operations.
          </p>

          {/* Upload Zone */}
          <Card className="p-6">
            <UploadZone onFileSelect={handleFileSelect} maxSize={100} disabled={isUploading} />
            {isUploading && (
              <p className="mt-4 text-sm text-gray-500">Loading PDF...</p>
            )}
          </Card>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-12">
            How It Works
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<FileText className="w-8 h-8 text-blue-600" />}
              title="1. Upload PDF"
              description="Drag and drop your PDF file or click to browse. Supports files up to 100MB."
            />
            <FeatureCard
              icon={<Zap className="w-8 h-8 text-blue-600" />}
              title="2. Select Watermark"
              description="Draw a rectangle over the watermark area. We'll remove it from all pages."
            />
            <FeatureCard
              icon={<Shield className="w-8 h-8 text-blue-600" />}
              title="3. Download Clean PDF"
              description="Preview the result and download your watermark-free PDF instantly."
            />
          </div>
        </div>
      </section>

      {/* Privacy Note */}
      <section className="py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-full text-sm">
            <Shield className="w-4 h-4" />
            <span>Your files are processed locally when possible. No data stored on servers.</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-500 dark:text-gray-400">
          PDF Watermark Remover - Free Online Tool
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}
