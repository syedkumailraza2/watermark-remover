"use client";

import { Loader2, CheckCircle, XCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { RemovalProgress, RemovalResult } from "@/lib/pdf/remover";

interface ProcessingPanelProps {
  isProcessing: boolean;
  progress: RemovalProgress | null;
  result: RemovalResult | null;
  error: string | null;
  onDownload: () => void;
  onReset: () => void;
}

export function ProcessingPanel({
  isProcessing,
  progress,
  result,
  error,
  onDownload,
  onReset,
}: ProcessingPanelProps) {
  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-600" />
          <div className="flex-1">
            <p className="font-medium text-red-800 dark:text-red-200">Processing failed</p>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={onReset}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (result?.success) {
    return (
      <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div className="flex-1">
            <p className="font-medium text-green-800 dark:text-green-200">
              Watermark removed successfully!
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">
              Processed {result.pagesProcessed} page{result.pagesProcessed > 1 ? "s" : ""}
            </p>
          </div>
          <Button onClick={onDownload} className="gap-2">
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          <p className="font-medium text-blue-800 dark:text-blue-200">
            {progress?.status || "Processing..."}
          </p>
        </div>
        {progress && (
          <Progress
            value={progress.currentPage}
            max={progress.totalPages}
          />
        )}
      </div>
    );
  }

  return null;
}
