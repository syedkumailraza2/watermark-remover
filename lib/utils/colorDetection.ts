export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Detect the dominant background color around a selection area
 * by sampling pixels from multiple depths outside the selection
 * and finding the most common color cluster
 */
export function detectBackgroundColor(
  canvas: HTMLCanvasElement,
  selection: { x: number; y: number; width: number; height: number }
): RGB {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { r: 255, g: 255, b: 255 }; // Default to white

  const colors: RGB[] = [];
  const { x, y, width, height } = selection;

  // Sample at multiple depths (10, 20, 30, 40 pixels outside selection)
  const sampleDepths = [10, 20, 30, 40];
  const sampleStep = 5; // Sample every 5 pixels along edge

  for (const depth of sampleDepths) {
    // Top edge
    for (let i = 0; i < width; i += sampleStep) {
      const px = Math.max(0, Math.min(canvas.width - 1, Math.floor(x + i)));
      const py = Math.max(0, Math.floor(y - depth));
      if (py >= 0) {
        const color = getPixelColor(ctx, px, py);
        if (color) colors.push(color);
      }
    }

    // Bottom edge
    for (let i = 0; i < width; i += sampleStep) {
      const px = Math.max(0, Math.min(canvas.width - 1, Math.floor(x + i)));
      const py = Math.min(canvas.height - 1, Math.floor(y + height + depth));
      if (py < canvas.height) {
        const color = getPixelColor(ctx, px, py);
        if (color) colors.push(color);
      }
    }

    // Left edge
    for (let i = 0; i < height; i += sampleStep) {
      const px = Math.max(0, Math.floor(x - depth));
      const py = Math.max(0, Math.min(canvas.height - 1, Math.floor(y + i)));
      if (px >= 0) {
        const color = getPixelColor(ctx, px, py);
        if (color) colors.push(color);
      }
    }

    // Right edge
    for (let i = 0; i < height; i += sampleStep) {
      const px = Math.min(canvas.width - 1, Math.floor(x + width + depth));
      const py = Math.max(0, Math.min(canvas.height - 1, Math.floor(y + i)));
      if (px < canvas.width) {
        const color = getPixelColor(ctx, px, py);
        if (color) colors.push(color);
      }
    }
  }

  if (colors.length === 0) {
    return { r: 255, g: 255, b: 255 };
  }

  // Find dominant color using clustering
  // Group similar colors (within threshold) and find largest group
  return findDominantColor(colors);
}

/**
 * Find the most common color by clustering similar colors together
 */
function findDominantColor(colors: RGB[], threshold: number = 30): RGB {
  if (colors.length === 0) return { r: 255, g: 255, b: 255 };

  // Use a map to count similar colors
  const colorClusters: { center: RGB; count: number; sum: RGB }[] = [];

  for (const color of colors) {
    // Find existing cluster within threshold
    let found = false;
    for (const cluster of colorClusters) {
      const dist = colorDistance(color, cluster.center);
      if (dist < threshold) {
        cluster.count++;
        cluster.sum.r += color.r;
        cluster.sum.g += color.g;
        cluster.sum.b += color.b;
        // Update center to be average of cluster
        cluster.center = {
          r: Math.round(cluster.sum.r / cluster.count),
          g: Math.round(cluster.sum.g / cluster.count),
          b: Math.round(cluster.sum.b / cluster.count),
        };
        found = true;
        break;
      }
    }

    if (!found) {
      colorClusters.push({
        center: { ...color },
        count: 1,
        sum: { ...color },
      });
    }
  }

  // Return center of largest cluster
  const largest = colorClusters.reduce((max, cluster) =>
    cluster.count > max.count ? cluster : max
  );

  return largest.center;
}

/**
 * Calculate Euclidean distance between two colors
 */
function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt(
    Math.pow(a.r - b.r, 2) +
    Math.pow(a.g - b.g, 2) +
    Math.pow(a.b - b.b, 2)
  );
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

export interface GradientColors {
  topLeft: RGB;
  topRight: RGB;
  bottomLeft: RGB;
  bottomRight: RGB;
}

/**
 * Detect gradient colors by sampling along each edge outside the selection.
 * This creates a more accurate gradient that matches the surrounding background.
 */
export function detectGradientColors(
  canvas: HTMLCanvasElement,
  selection: { x: number; y: number; width: number; height: number },
  sampleOffset: number = 20
): GradientColors {
  const ctx = canvas.getContext("2d");
  const defaultColor = { r: 255, g: 255, b: 255 };

  if (!ctx) {
    return {
      topLeft: defaultColor,
      topRight: defaultColor,
      bottomLeft: defaultColor,
      bottomRight: defaultColor,
    };
  }

  const { x, y, width, height } = selection;

  // Sample along an edge and find the dominant color
  const sampleEdge = (points: { x: number; y: number }[]): RGB => {
    const colors: RGB[] = [];
    for (const point of points) {
      const px = Math.max(0, Math.min(canvas.width - 1, Math.floor(point.x)));
      const py = Math.max(0, Math.min(canvas.height - 1, Math.floor(point.y)));
      const color = getPixelColor(ctx, px, py);
      if (color) colors.push(color);
    }
    if (colors.length === 0) return defaultColor;
    return findDominantColor(colors, 20);
  };

  const numSamples = 10;

  // Sample points along each edge, offset from the selection
  // Top edge - sample above the selection
  const topLeftPoints: { x: number; y: number }[] = [];
  const topRightPoints: { x: number; y: number }[] = [];
  for (let i = 0; i < numSamples; i++) {
    const t = i / (numSamples - 1);
    const edgeX = x + width * t;
    // Sample at multiple offsets for robustness
    for (const offset of [sampleOffset, sampleOffset * 1.5, sampleOffset * 2]) {
      if (t < 0.5) {
        topLeftPoints.push({ x: edgeX, y: y - offset });
      } else {
        topRightPoints.push({ x: edgeX, y: y - offset });
      }
    }
  }

  // Bottom edge - sample below the selection
  const bottomLeftPoints: { x: number; y: number }[] = [];
  const bottomRightPoints: { x: number; y: number }[] = [];
  for (let i = 0; i < numSamples; i++) {
    const t = i / (numSamples - 1);
    const edgeX = x + width * t;
    for (const offset of [sampleOffset, sampleOffset * 1.5, sampleOffset * 2]) {
      if (t < 0.5) {
        bottomLeftPoints.push({ x: edgeX, y: y + height + offset });
      } else {
        bottomRightPoints.push({ x: edgeX, y: y + height + offset });
      }
    }
  }

  // Also sample from left and right edges for corner accuracy
  for (let i = 0; i < numSamples; i++) {
    const t = i / (numSamples - 1);
    const edgeY = y + height * t;
    for (const offset of [sampleOffset, sampleOffset * 1.5]) {
      if (t < 0.5) {
        topLeftPoints.push({ x: x - offset, y: edgeY });
        topRightPoints.push({ x: x + width + offset, y: edgeY });
      } else {
        bottomLeftPoints.push({ x: x - offset, y: edgeY });
        bottomRightPoints.push({ x: x + width + offset, y: edgeY });
      }
    }
  }

  return {
    topLeft: sampleEdge(topLeftPoints),
    topRight: sampleEdge(topRightPoints),
    bottomLeft: sampleEdge(bottomLeftPoints),
    bottomRight: sampleEdge(bottomRightPoints),
  };
}

/**
 * Check if the gradient colors indicate a significant gradient
 * Returns true if there's noticeable color variation
 */
export function hasSignificantGradient(gradient: GradientColors, threshold: number = 10): boolean {
  const colors = [gradient.topLeft, gradient.topRight, gradient.bottomLeft, gradient.bottomRight];

  // Check max difference between any two corners
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const diff = colorDistance(colors[i], colors[j]);
      if (diff > threshold) return true;
    }
  }
  return false;
}
