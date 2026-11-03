"use client";

import { useRef, useState, useCallback } from "react";
import { formatFileSize } from "@/lib/supabase/storage";
import { Upload, X } from "lucide-react";

type FileUploadProps = {
  /** 허용 MIME 타입 (예: "image/*", ".pdf,.docx") */
  accept?: string;
  /** 다중 파일 허용 */
  multiple?: boolean;
  /** 최대 파일 수 */
  maxFiles?: number;
  /** 선택한 파일 콜백 */
  onFilesChange: (files: File[]) => void;
  /** 기존 선택 파일 (제어 컴포넌트) */
  files?: File[];
  /** 라벨 */
  label?: string;
  /** 비활성화 */
  disabled?: boolean;
};

export function FileUpload({
  accept,
  multiple = false,
  maxFiles = 10,
  onFilesChange,
  files = [],
  label = "파일 선택",
  disabled = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return;
      const arr = Array.from(newFiles);
      const combined = multiple ? [...files, ...arr].slice(0, maxFiles) : arr.slice(0, 1);
      onFilesChange(combined);
    },
    [files, multiple, maxFiles, onFilesChange]
  );

  const removeFile = useCallback(
    (index: number) => {
      onFilesChange(files.filter((_, i) => i !== index));
    },
    [files, onFilesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!disabled) addFiles(e.dataTransfer.files);
    },
    [disabled, addFiles]
  );

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-slate-200 hover:border-primary/50"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => addFiles(e.target.files)}
          className="hidden"
          disabled={disabled}
        />
        <Upload className="mx-auto size-8 text-muted-foreground" strokeWidth={1.5} />
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        <p className="text-xs text-muted-foreground/70">
          드래그 & 드롭 또는 클릭
          {multiple && ` (최대 ${maxFiles}개)`}
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"
            >
              <span className="flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                disabled={disabled}
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
