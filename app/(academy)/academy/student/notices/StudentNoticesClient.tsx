"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getMyClassNotices,
  getClassNoticeWithAttachments,
  listAcademyNotices,
  getAcademyNoticeWithAttachments,
} from "@/app/(admin)/admin/actions";
import { FileList } from "@/components/forms/FileList";
import { LoadingState } from "@/components/feedback/LoadingState";
import { EmptyState } from "@/components/feedback/EmptyState";
import type { ClassNotice, ClassNoticeAttachment, AcademyNotice, AcademyNoticeAttachment } from "@/lib/types";
import { formatDateKst } from "@/lib/utils/date-kst";

type NoticeItem = {
  id: string;
  type: "class" | "academy";
  title: string;
  content: string | null;
  is_pinned: boolean;
  created_at: string;
  class_name?: string;
  author_name?: string;
  attachment_count?: number;
};

export function StudentNoticesClient({
  studentProfileId,
}: {
  studentProfileId: string;
}) {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "class" | "academy">("all");
  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);
  const [attachments, setAttachments] = useState<{ id: string; original_filename: string; public_url: string; mime_type: string; file_size: number }[]>([]);

  const loadNotices = useCallback(async () => {
    setLoading(true);
    const [classNotices, academyNotices] = await Promise.all([
      getMyClassNotices(studentProfileId),
      listAcademyNotices(false),
    ]);

    const items: NoticeItem[] = [
      ...classNotices.map((n) => ({
        id: n.id,
        type: "class" as const,
        title: n.title,
        content: n.content,
        is_pinned: n.is_pinned,
        created_at: n.created_at,
        class_name: n.class_name,
        author_name: n.author_name,
        attachment_count: n.attachment_count,
      })),
      ...academyNotices.map((n) => ({
        id: n.id,
        type: "academy" as const,
        title: n.title,
        content: n.content,
        is_pinned: n.is_pinned,
        created_at: n.published_at,
        author_name: undefined,
        attachment_count: (n.image_count ?? 0) + (n.attachment_count ?? 0),
      })),
    ];

    // 고정 먼저, 그 다음 최신순
    items.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setNotices(items);
    setLoading(false);
  }, [studentProfileId]);

  useEffect(() => {
    loadNotices();
  }, [loadNotices]);

  const openDetail = async (notice: NoticeItem) => {
    if (notice.type === "class") {
      const result = await getClassNoticeWithAttachments(notice.id);
      if (result) {
        setSelectedNotice({ ...notice, content: result.notice.content });
        setAttachments(result.attachments.map((a) => ({
          id: a.id, original_filename: a.original_filename,
          public_url: a.public_url, mime_type: a.mime_type, file_size: a.file_size,
        })));
      }
    } else {
      const result = await getAcademyNoticeWithAttachments(notice.id);
      if (result) {
        setSelectedNotice({ ...notice, content: result.notice.content });
        setAttachments([...result.images, ...result.attachments].map((a) => ({
          id: a.id, original_filename: a.original_filename,
          public_url: a.public_url, mime_type: a.mime_type, file_size: a.file_size,
        })));
      }
    }
  };

  const closeDetail = () => {
    setSelectedNotice(null);
    setAttachments([]);
  };

  const filtered = tab === "all" ? notices : notices.filter((n) => n.type === tab);

  if (loading) {
    return <LoadingState label="공지사항 불러오는 중..." />;
  }

  if (selectedNotice) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={closeDetail}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          목록으로
        </button>
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {selectedNotice.is_pinned && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  고정
                </span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                selectedNotice.type === "class"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}>
                {selectedNotice.type === "class" ? selectedNotice.class_name ?? "반 공지" : "학원 공지"}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-foreground">{selectedNotice.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedNotice.author_name ? `${selectedNotice.author_name} · ` : ""}
              {formatDateKst(selectedNotice.created_at)}
            </p>
          </div>
          {selectedNotice.content && (
            <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
              {selectedNotice.content}
            </div>
          )}
          {attachments.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">첨부파일</h3>
              <FileList files={attachments} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab filter */}
      <div className="flex gap-1">
        {(["all", "academy", "class"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t === "all" ? `전체 (${notices.length})` : t === "academy" ? `학원 (${notices.filter((n) => n.type === "academy").length})` : `반 (${notices.filter((n) => n.type === "class").length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="공지사항이 없습니다." />
      ) : (
        <ul className="space-y-2">
          {filtered.map((n) => (
            <li key={`${n.type}-${n.id}`}>
              <button
                type="button"
                onClick={() => openDetail(n)}
                className="w-full text-left rounded-xl border bg-card p-4 shadow-sm hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start gap-2">
                  {n.is_pinned && (
                    <span className="shrink-0 mt-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      고정
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        n.type === "class"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {n.type === "class" ? n.class_name ?? "반" : "학원"}
                      </span>
                      <h3 className="text-sm font-medium text-foreground truncate">{n.title}</h3>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {n.author_name && <span>{n.author_name}</span>}
                      {n.author_name && <span>·</span>}
                      <span>{formatDateKst(n.created_at)}</span>
                      {(n.attachment_count ?? 0) > 0 && (
                        <>
                          <span>·</span>
                          <span>첨부 {n.attachment_count}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
