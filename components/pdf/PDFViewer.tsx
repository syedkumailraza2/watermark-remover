"use client";

import { useRef, useEffect, useCallback, MouseEvent, forwardRef, useImperativeHandle } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPage, RenderTask } from "@/lib/pdf/renderer";
import { Selection } from "@/hooks/useSelection";

interface PDFViewerProps {
  pdf: PDFDocumentProxy;
  currentPage: number;
  scale: number;
  selection: Selection | null;
  isSelecting: boolean;
  onSelectionStart: (e: MouseEvent, containerRect: DOMRect) => void;
  onSelectionMove: (e: MouseEvent, containerRect: DOMRect) => void;
  onSelectionEnd: () => void;
}

export interface PDFViewerHandle {
  getCanvas: () => HTMLCanvasElement | null;
}

export const PDFViewer = forwardRef<PDFViewerHandle, PDFViewerProps>(function PDFViewer({
  pdf,
  currentPage,
  scale,
  selection,
  isSelecting,
  onSelectionStart,
  onSelectionMove,
  onSelectionEnd,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }));

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    // Cancel any previous render task
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    const task = renderPage(pdf, currentPage, canvasRef.current, scale);
    renderTaskRef.current = task;

    task.promise.catch((err) => {
      // Ignore cancellation errors
      if (err?.message !== "Render cancelled") {
        console.error("Render error:", err);
      }
    });

    return () => {
      task.cancel();
    };
  }, [pdf, currentPage, scale]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    onSelectionStart(e, rect);
  }, [onSelectionStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current || !isSelecting) return;
    const rect = containerRef.current.getBoundingClientRect();
    onSelectionMove(e, rect);
  }, [isSelecting, onSelectionMove]);

  const handleMouseUp = useCallback(() => {
    onSelectionEnd();
  }, [onSelectionEnd]);

  return (
    <div
      ref={containerRef}
      className="relative inline-block cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas ref={canvasRef} className="pdf-canvas shadow-lg" />

      {/* Selection overlay */}
      {selection && (
        <div
          className="selection-box absolute"
          style={{
            left: selection.x,
            top: selection.y,
            width: selection.width,
            height: selection.height,
          }}
        >
          {/* Resize handles */}
          {!isSelecting && (
            <>
              <div className="selection-handle -top-1 -left-1 cursor-nw-resize" />
              <div className="selection-handle -top-1 -right-1 cursor-ne-resize" />
              <div className="selection-handle -bottom-1 -left-1 cursor-sw-resize" />
              <div className="selection-handle -bottom-1 -right-1 cursor-se-resize" />
            </>
          )}
        </div>
      )}
    </div>
  );
});
