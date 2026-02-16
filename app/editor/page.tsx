"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, FileText, Check } from "lucide-react";
import { PDFViewer, PDFViewerHandle } from "@/components/pdf/PDFViewer";
import { ZoomControls } from "@/components/pdf/ZoomControls";
import { PageNavigation } from "@/components/pdf/PageNavigation";
import { ProcessingPanel } from "@/components/processing/ProcessingPanel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { usePDF } from "@/hooks/usePDF";
import { useSelection } from "@/hooks/useSelection";
import { useProcessing } from "@/hooks/useProcessing";
import { getFile, clearFile } from "@/lib/storage/indexedDB";
import { detectBackgroundColor, rgbToNormalized } from "@/lib/utils/colorDetection";

export default function EditorPage() {
  const router = useRouter();
  const pdfViewerRef = useRef<PDFViewerHandle>(null);
  const [pdfSource, setPdfSource] = useState<ArrayBuffer | null>(null);
  const [filename, setFilename] = useState<string>("document.pdf");
  const [applyToAll, setApplyToAll] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);

  const {
    pdf,
    numPages,
    currentPage,
    scale,
    loading,
    error: pdfError,
    setCurrentPage,
    setScale,
  } = usePDF(pdfSource);

  const {
    selection,
    isSelecting,
    startSelection,
    updateSelection,
    endSelection,
    clearSelection,
  } = useSelection();

  const {
    isProcessing,
    progress,
    result,
    error: processingError,
    processFile,
    downloadResult,
    reset: resetProcessing,
  } = useProcessing();

  // Load PDF from IndexedDB on mount
  useEffect(() => {
    async function loadFromStorage() {
      try {
        const stored = await getFile();
        if (!stored) {
          router.push("/");
          return;
        }
        setPdfSource(stored.data);
        setFilename(stored.filename);
      } catch (error) {
        console.error("Failed to load file:", error);
        router.push("/");
      } finally {
        setInitialLoading(false);
      }
    }
    loadFromStorage();
  }, [router]);

  const handleRemoveWatermark = useCallback(async () => {
    if (!selection) return;

    // Reload from IndexedDB to get a fresh ArrayBuffer (the original may be detached by pdf.js)
    const stored = await getFile();
    if (!stored) {
      console.error("File not found in storage");
      return;
    }

    // Detect background color from the canvas
    let backgroundColor = { r: 1, g: 1, b: 1 }; // Default white
    const canvas = pdfViewerRef.current?.getCanvas();
    if (canvas) {
      const detectedColor = detectBackgroundColor(canvas, selection);
      backgroundColor = rgbToNormalized(detectedColor);
    }

    await processFile(stored.data, {
      selection,
      scale,
      applyToAllPages: applyToAll,
      backgroundColor,
    });
  }, [selection, scale, applyToAll, processFile]);

  const handleDownload = useCallback(() => {
    downloadResult(filename);
  }, [downloadResult, filename]);

  const handleGoBack = useCallback(async () => {
    await clearFile();
    router.push("/");
  }, [router]);

  if (initialLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (pdfError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-6 max-w-md text-center">
          <p className="text-red-600 mb-4">{pdfError}</p>
          <Button onClick={handleGoBack}>Go Back</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={handleGoBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>

              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <FileText className="w-4 h-4" />
                <span className="truncate max-w-[200px]">{filename}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {pdf && <PageNavigation currentPage={currentPage} numPages={numPages} onPageChange={setCurrentPage} />}
              <ZoomControls scale={scale} onScaleChange={setScale} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* PDF Viewer */}
        <main className="flex-1 overflow-auto p-8 bg-gray-100 dark:bg-gray-950">
          <div className="flex justify-center">
            {pdf && (
              <PDFViewer
                ref={pdfViewerRef}
                pdf={pdf}
                currentPage={currentPage}
                scale={scale}
                selection={selection}
                isSelecting={isSelecting}
                onSelectionStart={startSelection}
                onSelectionMove={updateSelection}
                onSelectionEnd={endSelection}
              />
            )}
          </div>
        </main>

        {/* Sidebar */}
        <aside className="w-80 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col gap-4">
          {/* Instructions */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Select Watermark
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Click and drag on the PDF to select the watermark area you want to remove.
            </p>
          </Card>

          {/* Selection Info */}
          {selection && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Selection
                </h3>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-4">
                <p>Position: {Math.round(selection.x)}, {Math.round(selection.y)}</p>
                <p>Size: {Math.round(selection.width)} x {Math.round(selection.height)}</p>
              </div>

              {/* Apply to all toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                    ${applyToAll
                      ? "bg-blue-600 border-blue-600"
                      : "border-gray-300 dark:border-gray-600"
                    }`}
                  onClick={() => setApplyToAll(!applyToAll)}
                >
                  {applyToAll && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Apply to all {numPages} pages
                </span>
              </label>
            </Card>
          )}

          {/* Remove Button */}
          {selection && !result?.success && (
            <Button
              onClick={handleRemoveWatermark}
              disabled={isProcessing}
              className="w-full"
              size="lg"
            >
              {isProcessing ? "Processing..." : "Remove Watermark"}
            </Button>
          )}

          {/* Processing Panel */}
          <ProcessingPanel
            isProcessing={isProcessing}
            progress={progress}
            result={result}
            error={processingError}
            onDownload={handleDownload}
            onReset={resetProcessing}
          />

          {/* Tips */}
          <div className="mt-auto">
            <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                Tip
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                For best results, select an area slightly larger than the watermark to ensure complete removal.
              </p>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}
