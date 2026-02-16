import * as pdfjsLib from "pdfjs-dist";
import { detectBackgroundColor, detectGradientColors, rgbToNormalized } from "./colorDetection";

export interface NormalizedRGB {
  r: number;
  g: number;
  b: number;
}

export interface NormalizedGradient {
  topLeft: NormalizedRGB;
  topRight: NormalizedRGB;
  bottomLeft: NormalizedRGB;
  bottomRight: NormalizedRGB;
}

export interface Selection {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Detect background colors for all pages in a PDF
 * by rendering each page and sampling around the selection area
 */
export async function detectColorsForAllPages(
  pdfData: ArrayBuffer,
  selection: Selection,
  scale: number,
  numPages: number,
  onProgress?: (page: number, total: number) => void
): Promise<NormalizedRGB[]> {
  const colors: NormalizedRGB[] = [];

  // Load PDF with pdf.js
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;

  // Create an offscreen canvas for rendering
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    // Return white for all pages as fallback
    return Array(numPages).fill({ r: 1, g: 1, b: 1 });
  }

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(pageNum, numPages);

    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // Size canvas to page
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Clear canvas
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render page
      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;

      // Detect background color from this page's canvas
      const detectedRGB = detectBackgroundColor(canvas, selection);
      const normalized = rgbToNormalized(detectedRGB);
      colors.push(normalized);
    } catch (error) {
      console.error(`Failed to detect color for page ${pageNum}:`, error);
      // Use white as fallback for this page
      colors.push({ r: 1, g: 1, b: 1 });
    }
  }

  return colors;
}

/**
 * Detect gradient colors for all pages in a PDF
 */
export async function detectGradientsForAllPages(
  pdfData: ArrayBuffer,
  selection: Selection,
  scale: number,
  numPages: number,
  onProgress?: (page: number, total: number) => void
): Promise<NormalizedGradient[]> {
  const gradients: NormalizedGradient[] = [];

  // Load PDF with pdf.js
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;

  const defaultGradient: NormalizedGradient = {
    topLeft: { r: 1, g: 1, b: 1 },
    topRight: { r: 1, g: 1, b: 1 },
    bottomLeft: { r: 1, g: 1, b: 1 },
    bottomRight: { r: 1, g: 1, b: 1 },
  };

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(pageNum, numPages);

    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // Create a fresh canvas for each page to avoid any state issues
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        gradients.push(defaultGradient);
        continue;
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Clear with white background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render page
      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;

      // Clamp selection to page bounds for this specific page
      const clampedSelection = {
        x: Math.max(0, Math.min(selection.x, canvas.width - 10)),
        y: Math.max(0, Math.min(selection.y, canvas.height - 10)),
        width: Math.min(selection.width, canvas.width - selection.x),
        height: Math.min(selection.height, canvas.height - selection.y),
      };

      // Detect gradient colors from this page
      const detectedGradient = detectGradientColors(canvas, clampedSelection);
      gradients.push({
        topLeft: rgbToNormalized(detectedGradient.topLeft),
        topRight: rgbToNormalized(detectedGradient.topRight),
        bottomLeft: rgbToNormalized(detectedGradient.bottomLeft),
        bottomRight: rgbToNormalized(detectedGradient.bottomRight),
      });

      // Clean up
      canvas.width = 0;
      canvas.height = 0;
    } catch (error) {
      console.error(`Failed to detect gradient for page ${pageNum}:`, error);
      gradients.push(defaultGradient);
    }
  }

  return gradients;
}
