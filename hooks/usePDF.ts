"use client";

import { useState, useEffect, useCallback } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPDF } from "@/lib/pdf/renderer";

interface UsePDFReturn {
  pdf: PDFDocumentProxy | null;
  numPages: number;
  currentPage: number;
  scale: number;
  loading: boolean;
  error: string | null;
  setCurrentPage: (page: number) => void;
  setScale: (scale: number) => void;
  goToNextPage: () => void;
  goToPrevPage: () => void;
}

export function usePDF(source: string | ArrayBuffer | null): UsePDFReturn {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!source) return;

    const currentSource = source;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const pdfDoc = await loadPDF(currentSource);
        if (!cancelled) {
          setPdf(pdfDoc);
          setNumPages(pdfDoc.numPages);
          setCurrentPage(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load PDF");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [source]);

  const goToNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, numPages));
  }, [numPages]);

  const goToPrevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  return {
    pdf,
    numPages,
    currentPage,
    scale,
    loading,
    error,
    setCurrentPage,
    setScale,
    goToNextPage,
    goToPrevPage,
  };
}
