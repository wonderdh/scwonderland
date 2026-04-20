import type { Metadata } from "next";
import { getNoticeWithAttachments } from "@/app/(admin)/admin/actions/notice-actions";
import { PageContent } from "@/app/(site)/_components/sections/PageContent";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getNoticeWithAttachments(id);
  if (!data) return { title: "공지사항 | 원더랜드 영어학원" };
  return {
    title: `${data.notice.title} | 원더랜드 영어학원`,
    description:
      data.notice.excerpt ?? data.notice.content?.slice(0, 160) ?? "",
  };
}

export default async function NoticeDetailPage({ params }: Props) {
  const { id } = await params;
  const data = await getNoticeWithAttachments(id);

  if (!data || !data.notice.is_published) notFound();

  const { notice, images, attachments } = data;

  return (
    <PageContent title={notice.title}>
      <div className="mb-6">
        <time className="text-sm text-gray-500">
          {notice.published_at?.slice(0, 10)}
        </time>
        {notice.is_pinned && (
          <span className="ml-2 rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
            고정
          </span>
        )}
      </div>

      {/* 이미지 */}
      {images.length > 0 && (
        <div className="space-y-4 mb-8">
          {images.map((img) => (
            <div key={img.id} className="overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.public_url}
                alt={img.original_filename}
                className="max-w-full h-auto rounded-lg"
              />
            </div>
          ))}
        </div>
      )}

      {/* 내용 */}
      {notice.content && (
        <div className="whitespace-pre-wrap text-gray-700 leading-relaxed mb-8">
          {notice.content}
        </div>
      )}

      {/* 첨부파일 */}
      {attachments.length > 0 && (
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            첨부파일
          </h3>
          <ul className="space-y-2">
            {attachments.map((file) => (
              <li key={file.id}>
                <a
                  href={file.public_url}
                  download={file.original_filename}
                  className="inline-flex items-center gap-2 text-blue-600 hover:underline"
                >
                  <svg
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
                    />
                  </svg>
                  {file.original_filename}
                  <span className="text-xs text-gray-400">
                    ({(file.file_size / 1024 / 1024).toFixed(1)}MB)
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 목록으로 돌아가기 */}
      <div className="mt-10 border-t border-gray-200 pt-6">
        <Link
          href="/notice/news"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          목록으로 돌아가기
        </Link>
      </div>
    </PageContent>
  );
}
