"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface PageNavigationProps {
  currentPage: number;
  numPages: number;
  onPageChange: (page: number) => void;
}

export function PageNavigation({ currentPage, numPages, onPageChange }: PageNavigationProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      <span className="text-sm text-gray-600 dark:text-gray-400">
        Page{" "}
        <input
          type="number"
          min={1}
          max={numPages}
          value={currentPage}
          onChange={(e) => {
            const page = parseInt(e.target.value, 10);
            if (page >= 1 && page <= numPages) {
              onPageChange(page);
            }
          }}
          className="w-12 px-1 py-0.5 text-center border border-gray-300 dark:border-gray-600 rounded bg-transparent"
        />{" "}
        of {numPages}
      </span>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= numPages}
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
