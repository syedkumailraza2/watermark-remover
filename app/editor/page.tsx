"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, FileText, Check, Upload, X, Pipette } from "lucide-react";
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
import { detectColorsForAllPages, detectGradientsForAllPages } from "@/lib/utils/perPageColorDetection";
import { detectGradientColors, rgbToNormalized as rawRgbToNormalized } from "@/lib/utils/colorDetection";
import { hexToNormalizedRgb, rgbToHex } from "@/lib/utils/colorUtils";

export default function EditorPage() {
  const router = useRouter();
  const pdfViewerRef = useRef<PDFViewerHandle>(null);
  const [pdfSource, setPdfSource] = useState<ArrayBuffer | null>(null);
  const [filename, setFilename] = useState<string>("document.pdf");
  const [applyToAll, setApplyToAll] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);

  // Background color state
  const [useAutoColor, setUseAutoColor] = useState(true);
  const [manualBgColor, setManualBgColor] = useState("#ffffff");
  const [eyedropperMode, setEyedropperMode] = useState(false);
  const [detectedColor, setDetectedColor] = useState<string | null>(null);
  const [useGradientFill, setUseGradientFill] = useState(true); // Enable gradient by default for better results

  // Custom watermark state
  const [addCustomWatermark, setAddCustomWatermark] = useState(false);
  const [watermarkType, setWatermarkType] = useState<"text" | "image">("text");
  // Text watermark options
  const [watermarkText, setWatermarkText] = useState("");
  const [watermarkFontSize, setWatermarkFontSize] = useState(12);
  const [watermarkColor, setWatermarkColor] = useState("#000000");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.5);
  // Image watermark options
  const [watermarkImage, setWatermarkImage] = useState<ArrayBuffer | null>(null);
  const [watermarkImageName, setWatermarkImageName] = useState<string>("");
  const [watermarkImageType, setWatermarkImageType] = useState<"png" | "jpg">("png");
  const [watermarkImageScale, setWatermarkImageScale] = useState(0.8);

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

    // Get background color(s) or gradient(s)
    let backgroundColor = { r: 1, g: 1, b: 1 }; // Default white
    let backgroundColors: { r: number; g: number; b: number }[] | undefined;
    type GradientType = { topLeft: { r: number; g: number; b: number }; topRight: { r: number; g: number; b: number }; bottomLeft: { r: number; g: number; b: number }; bottomRight: { r: number; g: number; b: number } };
    let gradientFill: GradientType | undefined;
    let gradientFills: GradientType[] | undefined;

    if (useAutoColor) {
      if (useGradientFill) {
        // Detect gradients for seamless blending
        if (applyToAll && numPages > 1) {
          gradientFills = await detectGradientsForAllPages(
            stored.data.slice(0),
            selection,
            scale,
            numPages
          );
        } else {
          // Single page - detect gradient from current canvas
          const canvas = pdfViewerRef.current?.getCanvas();
          if (canvas) {
            const detected = detectGradientColors(canvas, selection);
            gradientFill = {
              topLeft: rawRgbToNormalized(detected.topLeft),
              topRight: rawRgbToNormalized(detected.topRight),
              bottomLeft: rawRgbToNormalized(detected.bottomLeft),
              bottomRight: rawRgbToNormalized(detected.bottomRight),
            };
          }
        }
      } else {
        // Solid color detection
        if (applyToAll && numPages > 1) {
          backgroundColors = await detectColorsForAllPages(
            stored.data.slice(0),
            selection,
            scale,
            numPages
          );
        } else {
          const canvas = pdfViewerRef.current?.getCanvas();
          if (canvas) {
            const detected = detectBackgroundColor(canvas, selection);
            backgroundColor = rgbToNormalized(detected);
          }
        }
      }
    } else {
      // Manual color - same for all pages (solid only)
      backgroundColor = hexToNormalizedRgb(manualBgColor);
    }

    // Build custom watermark options if enabled
    let customWatermark = undefined;
    if (addCustomWatermark) {
      if (watermarkType === "text" && watermarkText.trim()) {
        customWatermark = {
          type: "text" as const,
          text: watermarkText,
          fontSize: watermarkFontSize,
          color: hexToNormalizedRgb(watermarkColor),
          opacity: watermarkOpacity,
        };
      } else if (watermarkType === "image" && watermarkImage) {
        customWatermark = {
          type: "image" as const,
          imageData: watermarkImage,
          imageType: watermarkImageType,
          opacity: watermarkOpacity,
          scale: watermarkImageScale,
        };
      }
    }

    await processFile(stored.data, {
      selection,
      scale,
      applyToAllPages: applyToAll,
      backgroundColor,
      backgroundColors,
      useGradient: useGradientFill && useAutoColor,
      gradientFill,
      gradientFills,
      customWatermark,
    });
  }, [selection, scale, applyToAll, numPages, useAutoColor, useGradientFill, manualBgColor, addCustomWatermark, watermarkType, watermarkText, watermarkFontSize, watermarkColor, watermarkOpacity, watermarkImage, watermarkImageType, watermarkImageScale, processFile]);

  const handleDownload = useCallback(() => {
    downloadResult(filename);
  }, [downloadResult, filename]);

  const handleGoBack = useCallback(async () => {
    await clearFile();
    router.push("/");
  }, [router]);

  // Handle eyedropper color pick from canvas
  const handleEyedropperClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!eyedropperMode) return;

    const canvas = pdfViewerRef.current?.getCanvas();
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
      setManualBgColor(hex);
      setUseAutoColor(false);
      setEyedropperMode(false);
    } catch (err) {
      console.error("Failed to sample color:", err);
    }
  }, [eyedropperMode]);

  // Update detected color preview when selection changes
  useEffect(() => {
    if (!selection) {
      setDetectedColor(null);
      return;
    }

    const canvas = pdfViewerRef.current?.getCanvas();
    if (!canvas) return;

    const detected = detectBackgroundColor(canvas, selection);
    setDetectedColor(rgbToHex(detected.r, detected.g, detected.b));
  }, [selection]);

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
          <div
            className={`flex justify-center ${eyedropperMode ? "cursor-crosshair" : ""}`}
            onClick={handleEyedropperClick}
          >
            {pdf && (
              <PDFViewer
                ref={pdfViewerRef}
                pdf={pdf}
                currentPage={currentPage}
                scale={scale}
                selection={eyedropperMode ? null : selection}
                isSelecting={eyedropperMode ? false : isSelecting}
                onSelectionStart={eyedropperMode ? () => {} : startSelection}
                onSelectionMove={eyedropperMode ? () => {} : updateSelection}
                onSelectionEnd={eyedropperMode ? () => {} : endSelection}
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

          {/* Background Color Options */}
          {selection && (
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                Fill Color
              </h3>

              {/* Auto vs Manual toggle */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setUseAutoColor(true)}
                  className={`flex-1 py-2 px-3 text-sm rounded-lg border transition-colors ${
                    useAutoColor
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  Auto
                </button>
                <button
                  onClick={() => setUseAutoColor(false)}
                  className={`flex-1 py-2 px-3 text-sm rounded-lg border transition-colors ${
                    !useAutoColor
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  Manual
                </button>
              </div>

              {useAutoColor ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <div
                      className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
                      style={{ backgroundColor: detectedColor || "#ffffff" }}
                    />
                    <span>Detected: {detectedColor || "N/A"}</span>
                  </div>

                  {/* Gradient fill toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                        ${useGradientFill
                          ? "bg-blue-600 border-blue-600"
                          : "border-gray-300 dark:border-gray-600"
                        }`}
                      onClick={() => setUseGradientFill(!useGradientFill)}
                    >
                      {useGradientFill && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Gradient fill (better blending)
                    </span>
                  </label>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={manualBgColor}
                      onChange={(e) => setManualBgColor(e.target.value)}
                      className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={manualBgColor}
                      onChange={(e) => setManualBgColor(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase"
                    />
                    <button
                      onClick={() => setEyedropperMode(!eyedropperMode)}
                      className={`p-2 rounded-lg border transition-colors ${
                        eyedropperMode
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                      title="Pick color from PDF"
                    >
                      <Pipette className="w-4 h-4" />
                    </button>
                  </div>
                  {eyedropperMode && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Click anywhere on the PDF to sample a color
                    </p>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Custom Watermark Options */}
          {selection && (
            <Card className="p-4">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                    ${addCustomWatermark
                      ? "bg-blue-600 border-blue-600"
                      : "border-gray-300 dark:border-gray-600"
                    }`}
                  onClick={() => setAddCustomWatermark(!addCustomWatermark)}
                >
                  {addCustomWatermark && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Add custom watermark
                </span>
              </label>

              {addCustomWatermark && (
                <div className="space-y-3">
                  {/* Type selector */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setWatermarkType("text")}
                      className={`flex-1 py-2 px-3 text-sm rounded-lg border transition-colors ${
                        watermarkType === "text"
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      Text
                    </button>
                    <button
                      onClick={() => setWatermarkType("image")}
                      className={`flex-1 py-2 px-3 text-sm rounded-lg border transition-colors ${
                        watermarkType === "image"
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      Image
                    </button>
                  </div>

                  {/* Text watermark options */}
                  {watermarkType === "text" && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Watermark Text
                        </label>
                        <input
                          type="text"
                          value={watermarkText}
                          onChange={(e) => setWatermarkText(e.target.value)}
                          placeholder="Enter watermark text"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Font Size
                          </label>
                          <input
                            type="number"
                            value={watermarkFontSize}
                            onChange={(e) => setWatermarkFontSize(Number(e.target.value))}
                            min={6}
                            max={72}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Color
                          </label>
                          <input
                            type="color"
                            value={watermarkColor}
                            onChange={(e) => setWatermarkColor(e.target.value)}
                            className="w-full h-9 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Image watermark options */}
                  {watermarkType === "image" && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Upload Image (PNG or JPG)
                        </label>
                        {!watermarkImage ? (
                          <label className="flex items-center justify-center gap-2 w-full py-3 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                            <Upload className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-500">Choose image</span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    setWatermarkImage(reader.result as ArrayBuffer);
                                    setWatermarkImageName(file.name);
                                    setWatermarkImageType(file.type === "image/png" ? "png" : "jpg");
                                  };
                                  reader.readAsArrayBuffer(file);
                                }
                              }}
                            />
                          </label>
                        ) : (
                          <div className="flex items-center justify-between p-2 border border-gray-300 dark:border-gray-600 rounded-lg">
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[180px]">
                              {watermarkImageName}
                            </span>
                            <button
                              onClick={() => {
                                setWatermarkImage(null);
                                setWatermarkImageName("");
                              }}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                            >
                              <X className="w-4 h-4 text-gray-500" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Scale: {Math.round(watermarkImageScale * 100)}%
                        </label>
                        <input
                          type="range"
                          value={watermarkImageScale}
                          onChange={(e) => setWatermarkImageScale(Number(e.target.value))}
                          min={0.1}
                          max={2}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}

                  {/* Opacity - shared by both types */}
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Opacity: {Math.round(watermarkOpacity * 100)}%
                    </label>
                    <input
                      type="range"
                      value={watermarkOpacity}
                      onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                      min={0.1}
                      max={1}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
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
              {isProcessing ? "Processing..." : (addCustomWatermark && (watermarkText || watermarkImage) ? "Replace Watermark" : "Remove Watermark")}
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
