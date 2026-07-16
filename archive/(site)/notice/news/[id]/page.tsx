import type { Metadata } from "next";
import { getNoticeWithAttachments } from "@/app/(admin)/admin/actions/notice-actions";
import { PageContent } from "@/app/(site)/_components/sections/PageContent";
import { notFound } from "next/navigation";
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

  const { notice } = data;

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

      {notice.content && (
        <div className="whitespace-pre-wrap text-gray-700 leading-relaxed mb-8">
          {notice.content}
        </div>
      )}

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
