"use client";

import { formatFileSize } from "@/lib/supabase/storage";
import { Image as ImageIcon, Volume2, FileText, Trash2 } from "lucide-react";

type FileItem = {
  id: string;
  original_filename: string;
  public_url: string;
  mime_type: string;
  file_size: number;
};

type FileListProps = {
  files: FileItem[];
  onDelete?: (id: string) => void;
  deleting?: string | null;
  /** signed URL이 필요한 경우 (비공개 버킷) */
  getUrl?: (file: FileItem) => string;
};

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) {
    return (
      <ImageIcon className="size-5 text-blue-500" strokeWidth={1.5} />
    );
  }
  if (mimeType.startsWith("audio/")) {
    return (
      <Volume2 className="size-5 text-purple-500" strokeWidth={1.5} />
    );
  }
  return (
    <FileText className="size-5 text-slate-500" strokeWidth={1.5} />
  );
}

export function FileList({ files, onDelete, deleting, getUrl }: FileListProps) {
  if (files.length === 0) return null;

  return (
    <ul className="space-y-1">
      {files.map((file) => {
        const url = getUrl ? getUrl(file) : file.public_url;
        const isAudio = file.mime_type.startsWith("audio/");
        const isImage = file.mime_type.startsWith("image/");

        return (
          <li key={file.id} className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-3">
              <FileIcon mimeType={file.mime_type} />
              <div className="flex-1 min-w-0">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-foreground hover:text-primary truncate block"
                >
                  {file.original_filename}
                </a>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(file.file_size)}
                </span>
              </div>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(file.id)}
                  disabled={deleting === file.id}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="size-4" strokeWidth={1.5} />
                </button>
              )}
            </div>
            {/* 이미지 썸네일 */}
            {isImage && (
              <div className="mt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={file.original_filename}
                  className="max-h-32 rounded-md object-contain"
                />
              </div>
            )}
            {/* 오디오 플레이어 */}
            {isAudio && (
              <div className="mt-2">
                { }
                <audio controls src={url} className="w-full h-10" preload="metadata" />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
