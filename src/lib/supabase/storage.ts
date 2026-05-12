/**
 * Supabase Storage 공통 유틸리티
 * 버킷 설정, 파일 검증, 경로 생성, URL 추출 등
 */

// ── 버킷 상수 ──

export const STORAGE_BUCKETS = {
  NOTICE_FILES: "notice-files",
  CLASS_NOTICES: "class-notices",
  ACADEMY_NOTICES: "academy-notices",
  HOMEWORK_SUBMISSIONS: "homework-submissions",
  TEXTBOOK_COVERS: "textbook-covers",
} as const;

export type BucketId = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

// ── 파일 검증 ──

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const ALLOWED_AUDIO_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB

export type FileCategory = "image" | "document" | "audio";

const FILE_RULES: Record<
  FileCategory,
  { allowed: string[]; maxSize: number; errorType: string; errorSize: string }
> = {
  image: {
    allowed: ALLOWED_IMAGE_TYPES,
    maxSize: MAX_IMAGE_SIZE,
    errorType: "허용되지 않는 이미지 형식입니다. (JPG, PNG, WebP만 가능)",
    errorSize: `이미지 크기가 ${MAX_IMAGE_SIZE / 1024 / 1024}MB를 초과합니다.`,
  },
  document: {
    allowed: ALLOWED_DOCUMENT_TYPES,
    maxSize: MAX_DOCUMENT_SIZE,
    errorType: "허용되지 않는 파일 형식입니다. (PDF, ZIP, DOCX, XLSX만 가능)",
    errorSize: `파일 크기가 ${MAX_DOCUMENT_SIZE / 1024 / 1024}MB를 초과합니다.`,
  },
  audio: {
    allowed: ALLOWED_AUDIO_TYPES,
    maxSize: MAX_AUDIO_SIZE,
    errorType: "허용되지 않는 오디오 형식입니다. (WebM, OGG, MP4, MP3, WAV만 가능)",
    errorSize: `오디오 크기가 ${MAX_AUDIO_SIZE / 1024 / 1024}MB를 초과합니다.`,
  },
};

/** 파일 유효성 검증 */
export function validateFile(
  file: File,
  category: FileCategory
): { valid: true } | { valid: false; error: string } {
  const rules = FILE_RULES[category];
  if (!rules.allowed.includes(file.type)) {
    return { valid: false, error: rules.errorType };
  }
  if (file.size > rules.maxSize) {
    return { valid: false, error: rules.errorSize };
  }
  return { valid: true };
}

// ── 경로 생성 ──

/** Storage 경로 생성 (충돌 방지: {folder}/{timestamp}_{random6자}{ext}) */
export function generateStoragePath(filename: string, folder?: string): string {
  const ext = filename.includes(".")
    ? filename.substring(filename.lastIndexOf("."))
    : "";
  const name = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
  return folder ? `${folder}/${name}` : name;
}

// ── URL 유틸리티 ──

/** public URL에서 storage path 추출 */
export function extractStoragePath(
  publicUrl: string,
  bucketId: string
): string | null {
  const marker = `/storage/v1/object/public/${bucketId}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.substring(idx + marker.length);
}

/** 파일 크기를 사람이 읽기 쉬운 형식으로 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** MIME 타입으로 파일 카테고리 판별 */
export function getFileCategory(mimeType: string): FileCategory | null {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return "image";
  if (ALLOWED_DOCUMENT_TYPES.includes(mimeType)) return "document";
  if (ALLOWED_AUDIO_TYPES.includes(mimeType)) return "audio";
  return null;
}

// ── 이미지 변환 (브라우저 전용) ──

/**
 * 클라이언트에서 이미지를 WebP 로 변환. 이미 webp 이면 그대로 반환.
 * 옵션: quality(0~1, 기본 0.85), maxWidth(기본 1600, 그 이상이면 비율 유지 축소).
 *
 * 호출은 반드시 브라우저 컨텍스트에서. SSR/Server Action 에서 부르면 throw.
 */
export async function convertImageToWebP(
  file: File,
  options: { quality?: number; maxWidth?: number } = {}
): Promise<File> {
  if (file.type === "image/webp") return file;

  const { quality = 0.85, maxWidth = 1600 } = options;
  const bitmap = await createImageBitmap(file);
  const scale = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas 2D context 를 사용할 수 없습니다.");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", quality)
  );
  if (!blob) throw new Error("WebP 변환에 실패했습니다.");

  const baseName = file.name.includes(".")
    ? file.name.substring(0, file.name.lastIndexOf("."))
    : file.name;
  return new File([blob], `${baseName}.webp`, { type: "image/webp" });
}
