import * as pdfjsLib from "pdfjs-dist";

// Set up the worker - use local file from public folder
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export interface PDFDocumentInfo {
  numPages: number;
  title?: string;
}

export interface PDFPageInfo {
  width: number;
  height: number;
  pageNumber: number;
}

export async function loadPDF(source: string | ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  const loadingTask = pdfjsLib.getDocument(source);
  return await loadingTask.promise;
}

export interface RenderTask {
  promise: Promise<PDFPageInfo>;
  cancel: () => void;
}

export function renderPage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): RenderTask {
  let cancelled = false;
  let renderTask: ReturnType<pdfjsLib.PDFPageProxy["render"]> | null = null;

  const promise = (async (): Promise<PDFPageInfo> => {
    const page = await pdf.getPage(pageNumber);
    if (cancelled) throw new Error("Render cancelled");

    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not get canvas context");

    renderTask = page.render({
      canvasContext: context,
      viewport,
    });

    await renderTask.promise;

    return {
      width: viewport.width,
      height: viewport.height,
      pageNumber,
    };
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      renderTask?.cancel();
    },
  };
}

export async function renderPageThumbnail(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  maxWidth: number = 150
): Promise<void> {
  const page = await pdf.getPage(pageNumber);
  const originalViewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / originalViewport.width;
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not get canvas context");

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;
}
