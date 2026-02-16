import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { Selection } from "@/hooks/useSelection";

export interface BackgroundColor {
  r: number;
  g: number;
  b: number;
}

export interface GradientFill {
  topLeft: BackgroundColor;
  topRight: BackgroundColor;
  bottomLeft: BackgroundColor;
  bottomRight: BackgroundColor;
}

export interface TextWatermark {
  type: "text";
  text: string;
  fontSize: number;
  color: BackgroundColor; // RGB values normalized 0-1
  opacity: number; // 0-1
}

export interface ImageWatermark {
  type: "image";
  imageData: ArrayBuffer;
  imageType: "png" | "jpg";
  opacity: number; // 0-1
  scale: number; // 0.1-2, scale relative to selection area
}

export type CustomWatermark = TextWatermark | ImageWatermark;

export interface RemovalOptions {
  selection: Selection;
  scale: number;
  applyToAllPages: boolean;
  mode: "object" | "pixel" | "auto";
  backgroundColor?: BackgroundColor; // RGB values normalized 0-1 (used for single page or fallback)
  backgroundColors?: BackgroundColor[]; // Per-page colors (index = page number - 1)
  gradientFill?: GradientFill; // Gradient fill for single page
  gradientFills?: GradientFill[]; // Per-page gradient fills
  useGradient?: boolean; // Whether to use gradient fill
  customWatermark?: CustomWatermark; // Optional replacement watermark
}

export interface RemovalResult {
  success: boolean;
  pdfBytes: Uint8Array | null;
  error?: string;
  pagesProcessed: number;
}

export interface RemovalProgress {
  currentPage: number;
  totalPages: number;
  status: string;
}

/**
 * Remove watermark from PDF by redacting the selected region.
 * This uses a pixel-based approach - drawing a white rectangle over the selection.
 * For more advanced removal, the server-side API should be used.
 */
export async function removeWatermark(
  pdfBytes: ArrayBuffer,
  options: RemovalOptions,
  onProgress?: (progress: RemovalProgress) => void
): Promise<RemovalResult> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const totalPages = options.applyToAllPages ? pages.length : 1;

    // Convert selection from canvas coordinates to PDF coordinates
    // The selection is in scaled canvas coordinates, we need to convert to PDF points
    const { selection, scale } = options;

    for (let i = 0; i < totalPages; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();

      onProgress?.({
        currentPage: i + 1,
        totalPages,
        status: `Processing page ${i + 1} of ${totalPages}`,
      });

      // Convert canvas coordinates to PDF coordinates
      // Canvas Y is top-down, PDF Y is bottom-up
      const pdfX = selection.x / scale;
      const pdfY = height - (selection.y + selection.height) / scale;
      const pdfWidth = selection.width / scale;
      const pdfHeight = selection.height / scale;

      // Draw fill over the watermark area
      const gradient = options.gradientFills?.[i] || options.gradientFill;

      if (options.useGradient && gradient) {
        // Draw gradient using multiple horizontal strips for smooth blending
        const numStrips = Math.max(50, Math.ceil(pdfHeight)); // At least 50 strips for smoothness
        const stripHeight = pdfHeight / numStrips;

        for (let strip = 0; strip < numStrips; strip++) {
          // Calculate vertical position (0 = bottom in PDF coords, 1 = top)
          const t = strip / (numStrips - 1); // 0 to 1, bottom to top

          // Bilinear interpolation for gradient
          // At bottom (t=0): interpolate between bottomLeft and bottomRight
          // At top (t=1): interpolate between topLeft and topRight
          // Then interpolate vertically

          // For each strip, also interpolate horizontally across width
          // But since we're drawing full-width strips, we'll use the average of left and right
          const leftColor = {
            r: gradient.bottomLeft.r + t * (gradient.topLeft.r - gradient.bottomLeft.r),
            g: gradient.bottomLeft.g + t * (gradient.topLeft.g - gradient.bottomLeft.g),
            b: gradient.bottomLeft.b + t * (gradient.topLeft.b - gradient.bottomLeft.b),
          };
          const rightColor = {
            r: gradient.bottomRight.r + t * (gradient.topRight.r - gradient.bottomRight.r),
            g: gradient.bottomRight.g + t * (gradient.topRight.g - gradient.bottomRight.g),
            b: gradient.bottomRight.b + t * (gradient.topRight.b - gradient.bottomRight.b),
          };

          // Average left and right for this strip (simple approach)
          // For better results, we could draw multiple vertical strips too
          const stripColor = {
            r: (leftColor.r + rightColor.r) / 2,
            g: (leftColor.g + rightColor.g) / 2,
            b: (leftColor.b + rightColor.b) / 2,
          };

          page.drawRectangle({
            x: pdfX,
            y: pdfY + strip * stripHeight,
            width: pdfWidth,
            height: stripHeight + 0.5, // Slight overlap to prevent gaps
            color: rgb(stripColor.r, stripColor.g, stripColor.b),
            opacity: 1,
          });
        }
      } else {
        // Solid color fill
        const bgColor = options.backgroundColors?.[i] || options.backgroundColor || { r: 1, g: 1, b: 1 };
        page.drawRectangle({
          x: pdfX,
          y: pdfY,
          width: pdfWidth,
          height: pdfHeight,
          color: rgb(bgColor.r, bgColor.g, bgColor.b),
          opacity: 1,
        });
      }

      // Add custom watermark if provided
      if (options.customWatermark) {
        const watermark = options.customWatermark;

        if (watermark.type === "text" && watermark.text.trim()) {
          const { text, fontSize, color, opacity } = watermark;
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const textWidth = font.widthOfTextAtSize(text, fontSize);
          const textHeight = fontSize;

          // Center the text in the selection area
          const textX = pdfX + (pdfWidth - textWidth) / 2;
          const textY = pdfY + (pdfHeight - textHeight) / 2;

          page.drawText(text, {
            x: textX,
            y: textY,
            size: fontSize,
            font,
            color: rgb(color.r, color.g, color.b),
            opacity,
          });
        } else if (watermark.type === "image") {
          const { imageData, imageType, opacity, scale } = watermark;

          // Embed the image based on type
          const image = imageType === "png"
            ? await pdfDoc.embedPng(imageData)
            : await pdfDoc.embedJpg(imageData);

          // Calculate scaled dimensions while maintaining aspect ratio
          const imgAspect = image.width / image.height;
          const areaAspect = pdfWidth / pdfHeight;

          let drawWidth: number;
          let drawHeight: number;

          if (imgAspect > areaAspect) {
            // Image is wider than area - fit to width
            drawWidth = pdfWidth * scale;
            drawHeight = drawWidth / imgAspect;
          } else {
            // Image is taller than area - fit to height
            drawHeight = pdfHeight * scale;
            drawWidth = drawHeight * imgAspect;
          }

          // Center the image in the selection area
          const imgX = pdfX + (pdfWidth - drawWidth) / 2;
          const imgY = pdfY + (pdfHeight - drawHeight) / 2;

          page.drawImage(image, {
            x: imgX,
            y: imgY,
            width: drawWidth,
            height: drawHeight,
            opacity,
          });
        }
      }
    }

    onProgress?.({
      currentPage: totalPages,
      totalPages,
      status: "Finalizing PDF...",
    });

    const outputBytes = await pdfDoc.save();

    return {
      success: true,
      pdfBytes: outputBytes,
      pagesProcessed: totalPages,
    };
  } catch (error) {
    return {
      success: false,
      pdfBytes: null,
      error: error instanceof Error ? error.message : "Failed to remove watermark",
      pagesProcessed: 0,
    };
  }
}

/**
 * Convert a data URL to ArrayBuffer
 */
export function dataURLToArrayBuffer(dataURL: string): ArrayBuffer {
  const base64 = dataURL.split(",")[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

/**
 * Convert Uint8Array to downloadable blob URL
 */
export function createDownloadURL(pdfBytes: Uint8Array): string {
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

/**
 * Trigger download of the processed PDF
 */
export function downloadPDF(pdfBytes: Uint8Array, filename: string): void {
  const url = createDownloadURL(pdfBytes);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(".pdf", "-no-watermark.pdf");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
