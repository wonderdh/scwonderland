import Link from "next/link";

type PageContentProps = {
  title: string;
  children: React.ReactNode;
};

export function PageContent({ title, children }: PageContentProps) {
  return (
    <section className="scroll-mt-24 bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-8 text-4xl font-bold text-gray-900 md:text-5xl">
            {title}
          </h1>
          <div className="prose prose-lg max-w-none text-gray-600">
            {children}
          </div>
          <div className="mt-12">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded bg-gray-900 px-6 py-3 text-white transition hover:bg-gray-800"
            >
              ← 왜 원드랜드 일까요?
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
