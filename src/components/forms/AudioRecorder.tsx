"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type AudioRecorderProps = {
  /** 녹음 완료 시 Blob 반환 */
  onRecordingComplete: (blob: Blob) => void;
  /** 최대 녹음 시간 (초, 기본 300초=5분) */
  maxDuration?: number;
  /** 비활성화 */
  disabled?: boolean;
};

type RecorderState = "idle" | "recording" | "recorded";

export function AudioRecorder({
  onRecordingComplete,
  maxDuration = 300,
  disabled = false,
}: AudioRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 타이머 정리
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 스트림 정리
  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      clearTimer();
      cleanupStream();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [clearTimer, cleanupStream, audioUrl]);

  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        cleanupStream();
        clearTimer();

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);

        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(url);
        setState("recorded");
        onRecordingComplete(blob);
      };

      recorder.start(1000); // 1초 간격 데이터
      setState("recording");
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= maxDuration) {
            recorder.stop();
          }
          return next;
        });
      }, 1000);
    } catch {
      setError("마이크 접근이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해 주세요.");
    }
  }, [maxDuration, onRecordingComplete, cleanupStream, clearTimer, audioUrl]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const resetRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setState("idle");
    setElapsed(0);
    chunksRef.current = [];
  }, [audioUrl]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {state === "idle" && (
        <Button
          type="button"
          onClick={startRecording}
          disabled={disabled}
          variant="outline"
          className="w-full min-h-[44px] sm:min-h-[40px] gap-2"
        >
          <svg className="size-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
          녹음 시작
        </Button>
      )}

      {state === "recording" && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          {/* 녹음 인디케이터 */}
          <div className="relative">
            <span className="block size-3 rounded-full bg-red-500 animate-pulse" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700">녹음 중…</p>
            <p className="text-xs text-red-500">
              {formatTime(elapsed)} / {formatTime(maxDuration)}
            </p>
          </div>
          <Button
            type="button"
            onClick={stopRecording}
            variant="destructive"
            size="sm"
            className="min-h-[36px]"
          >
            정지
          </Button>
        </div>
      )}

      {state === "recorded" && audioUrl && (
        <div className="space-y-2 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">녹음 완료 ({formatTime(elapsed)})</p>
            <Button
              type="button"
              onClick={resetRecording}
              variant="outline"
              size="sm"
              disabled={disabled}
            >
              다시 녹음
            </Button>
          </div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={audioUrl} className="w-full h-10" preload="metadata" />
        </div>
      )}
    </div>
  );
}
