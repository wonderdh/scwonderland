import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-gray-900 py-8 text-white">
      <div className="container mx-auto flex flex-col items-center gap-2 px-4 text-center">
        <Link
          href="/privacy"
          className="text-sm font-semibold text-white underline-offset-4 hover:underline"
        >
          개인정보처리방침
        </Link>
        <p className="text-sm text-white/70">
          &copy; 2026 원더랜드 영어학원. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
