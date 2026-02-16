"use client";

import { useState, useCallback, MouseEvent } from "react";

export interface Selection {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseSelectionReturn {
  selection: Selection | null;
  isSelecting: boolean;
  startSelection: (e: MouseEvent, containerRect: DOMRect) => void;
  updateSelection: (e: MouseEvent, containerRect: DOMRect) => void;
  endSelection: () => void;
  clearSelection: () => void;
  setSelection: (selection: Selection | null) => void;
}

export function useSelection(): UseSelectionReturn {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);

  const startSelection = useCallback((e: MouseEvent, containerRect: DOMRect) => {
    const x = e.clientX - containerRect.left;
    const y = e.clientY - containerRect.top;

    setStartPoint({ x, y });
    setSelection({ x, y, width: 0, height: 0 });
    setIsSelecting(true);
  }, []);

  const updateSelection = useCallback((e: MouseEvent, containerRect: DOMRect) => {
    if (!isSelecting || !startPoint) return;

    const currentX = e.clientX - containerRect.left;
    const currentY = e.clientY - containerRect.top;

    const x = Math.min(startPoint.x, currentX);
    const y = Math.min(startPoint.y, currentY);
    const width = Math.abs(currentX - startPoint.x);
    const height = Math.abs(currentY - startPoint.y);

    setSelection({ x, y, width, height });
  }, [isSelecting, startPoint]);

  const endSelection = useCallback(() => {
    setIsSelecting(false);
    setStartPoint(null);

    // Clear selection if too small (likely accidental click)
    if (selection && (selection.width < 10 || selection.height < 10)) {
      setSelection(null);
    }
  }, [selection]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setIsSelecting(false);
    setStartPoint(null);
  }, []);

  return {
    selection,
    isSelecting,
    startSelection,
    updateSelection,
    endSelection,
    clearSelection,
    setSelection,
  };
}
