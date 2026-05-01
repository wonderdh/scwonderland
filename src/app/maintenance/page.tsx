import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "점검 안내",
  description: "원더랜드 영어학원 홈페이지가 점검 중입니다.",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-rose-50 px-6 py-16">
      <section className="max-w-md w-full text-center space-y-6">
        <p className="text-sm font-medium tracking-widest text-amber-700/80 uppercase">
          Service Notice
        </p>
        <h1 className="text-3xl font-bold text-slate-900 leading-tight">
          홈페이지 점검 중입니다
        </h1>
        <div className="text-slate-600 leading-relaxed space-y-2">
          <p>
            더 안정적인 서비스 제공을 위해
            <br />
            <span className="font-semibold text-slate-800">
              토요일까지 시스템 점검
            </span>
            을 진행하고 있습니다.
          </p>
          <p>이용에 불편을 드려 진심으로 죄송합니다.</p>
        </div>
        <p className="pt-6 text-sm text-slate-500">
          점검이 완료되면 정상 이용이 가능합니다.
        </p>
      </section>
    </main>
  );
}
