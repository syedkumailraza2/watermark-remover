"use client";

import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ZoomControlsProps {
  scale: number;
  onScaleChange: (scale: number) => void;
  minScale?: number;
  maxScale?: number;
}

export function ZoomControls({
  scale,
  onScaleChange,
  minScale = 0.5,
  maxScale = 3,
}: ZoomControlsProps) {
  const zoomIn = () => {
    onScaleChange(Math.min(scale + 0.25, maxScale));
  };

  const zoomOut = () => {
    onScaleChange(Math.max(scale - 0.25, minScale));
  };

  const resetZoom = () => {
    onScaleChange(1.5);
  };

  const percentage = Math.round(scale * 100);

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={zoomOut} disabled={scale <= minScale}>
        <ZoomOut className="w-4 h-4" />
      </Button>

      <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[4rem] text-center">
        {percentage}%
      </span>

      <Button variant="ghost" size="sm" onClick={zoomIn} disabled={scale >= maxScale}>
        <ZoomIn className="w-4 h-4" />
      </Button>

      <Button variant="ghost" size="sm" onClick={resetZoom} title="Reset zoom">
        <Maximize className="w-4 h-4" />
      </Button>
    </div>
  );
}
