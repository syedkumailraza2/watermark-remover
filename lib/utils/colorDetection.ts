export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Detect the dominant background color around a selection area
 * by sampling pixels from the edges of the selection
 */
export function detectBackgroundColor(
  canvas: HTMLCanvasElement,
  selection: { x: number; y: number; width: number; height: number },
  sampleDepth: number = 5
): RGB {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { r: 255, g: 255, b: 255 }; // Default to white

  const colors: RGB[] = [];
  const { x, y, width, height } = selection;

  // Sample from edges just outside the selection
  // Top edge
  for (let i = 0; i < width; i += 10) {
    const px = Math.max(0, Math.min(canvas.width - 1, Math.floor(x + i)));
    const py = Math.max(0, Math.floor(y - sampleDepth));
    if (py >= 0) {
      const color = getPixelColor(ctx, px, py);
      if (color) colors.push(color);
    }
  }

  // Bottom edge
  for (let i = 0; i < width; i += 10) {
    const px = Math.max(0, Math.min(canvas.width - 1, Math.floor(x + i)));
    const py = Math.min(canvas.height - 1, Math.floor(y + height + sampleDepth));
    if (py < canvas.height) {
      const color = getPixelColor(ctx, px, py);
      if (color) colors.push(color);
    }
  }

  // Left edge
  for (let i = 0; i < height; i += 10) {
    const px = Math.max(0, Math.floor(x - sampleDepth));
    const py = Math.max(0, Math.min(canvas.height - 1, Math.floor(y + i)));
    if (px >= 0) {
      const color = getPixelColor(ctx, px, py);
      if (color) colors.push(color);
    }
  }

  // Right edge
  for (let i = 0; i < height; i += 10) {
    const px = Math.min(canvas.width - 1, Math.floor(x + width + sampleDepth));
    const py = Math.max(0, Math.min(canvas.height - 1, Math.floor(y + i)));
    if (px < canvas.width) {
      const color = getPixelColor(ctx, px, py);
      if (color) colors.push(color);
    }
  }

  if (colors.length === 0) {
    return { r: 255, g: 255, b: 255 };
  }

  // Calculate average color
  const avg = colors.reduce(
    (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }),
    { r: 0, g: 0, b: 0 }
  );

  return {
    r: Math.round(avg.r / colors.length),
    g: Math.round(avg.g / colors.length),
    b: Math.round(avg.b / colors.length),
  };
}

function getPixelColor(ctx: CanvasRenderingContext2D, x: number, y: number): RGB | null {
  try {
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    return { r: pixel[0], g: pixel[1], b: pixel[2] };
  } catch {
    return null;
  }
}

/**
 * Convert RGB (0-255) to normalized values (0-1) for pdf-lib
 */
export function rgbToNormalized(color: RGB): { r: number; g: number; b: number } {
  return {
    r: color.r / 255,
    g: color.g / 255,
    b: color.b / 255,
  };
}
