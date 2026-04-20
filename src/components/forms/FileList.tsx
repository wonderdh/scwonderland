"use client";

import { formatFileSize } from "@/lib/supabase/storage";

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
      <svg className="size-5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
      </svg>
    );
  }
  if (mimeType.startsWith("audio/")) {
    return (
      <svg className="size-5 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
      </svg>
    );
  }
  return (
    <svg className="size-5 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
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
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
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
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio controls src={url} className="w-full h-10" preload="metadata" />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
