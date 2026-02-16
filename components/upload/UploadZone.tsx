"use client";

import { useCallback, useState, DragEvent, ChangeEvent } from "react";
import { Upload, FileText, AlertCircle } from "lucide-react";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  maxSize?: number; // in MB
  disabled?: boolean;
}

export function UploadZone({ onFileSelect, maxSize = 100, disabled = false }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (file.type !== "application/pdf") {
      return "Please upload a PDF file";
    }
    if (file.size > maxSize * 1024 * 1024) {
      return `File size must be less than ${maxSize}MB`;
    }
    return null;
  }, [maxSize]);

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onFileSelect(file);
  }, [validateFile, onFileSelect]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [disabled, handleFile]);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }, [handleFile]);

  return (
    <div className="w-full">
      <label
        className={`upload-zone relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer
          ${isDragging ? "dragover border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          ${error ? "border-red-400" : ""}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="application/pdf"
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <div className={`p-4 rounded-full mb-4 ${isDragging ? "bg-blue-100 dark:bg-blue-900" : "bg-gray-100 dark:bg-gray-800"}`}>
            {isDragging ? (
              <FileText className="w-10 h-10 text-blue-600" />
            ) : (
              <Upload className="w-10 h-10 text-gray-500 dark:text-gray-400" />
            )}
          </div>

          <p className="mb-2 text-lg font-medium text-gray-700 dark:text-gray-300">
            {isDragging ? "Drop your PDF here" : "Drop your PDF here or click to browse"}
          </p>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            PDF files up to {maxSize}MB
          </p>
        </div>
      </label>

      {error && (
        <div className="flex items-center gap-2 mt-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}
    </div>
  );
}
