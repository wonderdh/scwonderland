import type { Metadata } from "next";
import { PageContent } from "@/app/(site)/_components/sections/PageContent";
import { listNotices } from "@/app/(admin)/admin/actions/notice-actions";
import Link from "next/link";

export const metadata: Metadata = {
  title: "News | 원더랜드 영어학원",
  description: "원더랜드 영어학원 News",
};

export default async function NewsPage() {
  const notices = await listNotices(false);

  return (
    <PageContent title="News">
      {notices.length === 0 ? (
        <p className="text-center text-gray-500 py-12">
          등록된 공지사항이 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {notices.map((item) => (
            <li key={item.id} className="py-6 first:pt-0">
              <Link href={`/notice/news/${item.id}`} className="block group">
                <article>
                  <div className="flex items-center gap-2">
                    <time
                      dateTime={item.published_at}
                      className="text-sm font-medium text-gray-500"
                    >
                      {item.published_at?.slice(0, 10)}
                    </time>
                    {item.is_pinned && (
                      <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                        고정
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                    {item.title}
                  </h2>
                  {item.excerpt && (
                    <p className="mt-2 text-gray-600">{item.excerpt}</p>
                  )}
                  {(item.image_count > 0 || item.attachment_count > 0) && (
                    <div className="mt-2 flex gap-3 text-xs text-gray-400">
                      {item.image_count > 0 && (
                        <span>이미지 {item.image_count}</span>
                      )}
                      {item.attachment_count > 0 && (
                        <span>첨부파일 {item.attachment_count}</span>
                      )}
                    </div>
                  )}
                </article>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContent>
  );
}
