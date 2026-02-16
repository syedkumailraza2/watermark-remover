"use client";

import { useState, useCallback } from "react";
import {
  removeWatermark,
  RemovalOptions,
  RemovalProgress,
  RemovalResult,
  BackgroundColor,
  downloadPDF,
} from "@/lib/pdf/remover";

interface UseProcessingReturn {
  isProcessing: boolean;
  progress: RemovalProgress | null;
  result: RemovalResult | null;
  error: string | null;
  processFile: (pdfData: ArrayBuffer, options: Omit<RemovalOptions, "mode">) => Promise<void>;
  downloadResult: (filename: string) => void;
  reset: () => void;
}

export function useProcessing(): UseProcessingReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<RemovalProgress | null>(null);
  const [result, setResult] = useState<RemovalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (
    pdfData: ArrayBuffer,
    options: Omit<RemovalOptions, "mode">
  ) => {
    setIsProcessing(true);
    setProgress(null);
    setResult(null);
    setError(null);

    try {
      // Make a copy of the ArrayBuffer since the original may be detached by pdf.js
      const pdfDataCopy = pdfData.slice(0);

      const removalResult = await removeWatermark(
        pdfDataCopy,
        { ...options, mode: "auto" },
        setProgress
      );

      if (removalResult.success) {
        setResult(removalResult);
      } else {
        setError(removalResult.error || "Failed to process PDF");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const downloadResult = useCallback((filename: string) => {
    if (result?.pdfBytes) {
      downloadPDF(result.pdfBytes, filename);
    }
  }, [result]);

  const reset = useCallback(() => {
    setIsProcessing(false);
    setProgress(null);
    setResult(null);
    setError(null);
  }, []);

  return {
    isProcessing,
    progress,
    result,
    error,
    processFile,
    downloadResult,
    reset,
  };
}
