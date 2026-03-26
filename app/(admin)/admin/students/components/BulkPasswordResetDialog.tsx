"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { UserWithProfile } from "@/lib/types";
import { bulkResetStudentPasswords } from "../../actions";

type GeneratedEntry = {
  id: string;
  name: string;
  idPrefix: string;
  password: string;
};

function generatePassword(email: string): string {
  const idPrefix = email.split("@")[0];
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${idPrefix}${rand}`;
}

export function BulkPasswordResetDialog({ users }: { users: UserWithProfile[] }) {
  const [open, setOpen] = useState(false);
  const [generated, setGenerated] = useState<GeneratedEntry[]>([]);
  const [applyPending, setApplyPending] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  const handleGenerate = () => {
    const entries = users
      .filter((u) => u.email)
      .map((u) => ({
        id: u.id,
        name: u.korean_name ?? u.first_name ?? u.email.split("@")[0],
        idPrefix: u.email.split("@")[0],
        password: generatePassword(u.email),
      }));
    setGenerated(entries);
    setResult(null);
  };

  const handleDownloadCsv = () => {
    const header = "이름,아이디,비밀번호\n";
    const rows = generated.map((e) => `${e.name},${e.idPrefix},${e.password}`).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "학생_비밀번호.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleApplyAll = async () => {
    if (!generated.length) return;
    setApplyPending(true);
    const res = await bulkResetStudentPasswords(
      generated.map((e) => ({ id: e.id, password: e.password }))
    );
    setApplyPending(false);
    setResult(res);
  };

  const handleClose = () => {
    setOpen(false);
    setGenerated([]);
    setResult(null);
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        비밀번호 일괄생성
      </Button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-white shadow-xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">비밀번호 일괄생성</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            형식: 아이디 + 4자리 숫자 (예: gilsudong2847)
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {generated.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <p className="text-slate-600">전체 학생 <span className="font-semibold">{users.length}명</span>의 비밀번호를 자동 생성합니다.</p>
              <p className="mt-1 text-slate-400">생성 후 CSV 다운로드하여 확인하고, 전체 적용할 수 있습니다.</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="text-left py-2 pr-4 font-medium">이름</th>
                    <th className="text-left py-2 pr-4 font-medium">아이디</th>
                    <th className="text-left py-2 font-medium">비밀번호</th>
                  </tr>
                </thead>
                <tbody>
                  {generated.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4 text-slate-700">{e.name}</td>
                      <td className="py-2 pr-4 font-mono text-slate-500">{e.idPrefix}</td>
                      <td className="py-2 font-mono text-slate-900">{e.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result && (
                <p className={`mt-4 text-sm px-3 py-2 rounded-lg ${
                  result.failed > 0
                    ? "text-amber-700 bg-amber-50"
                    : "text-emerald-700 bg-emerald-50"
                }`}>
                  {result.success}명 완료{result.failed > 0 ? `, ${result.failed}명 실패` : ""}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 flex-wrap">
          {generated.length === 0 ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleClose}>취소</Button>
              <Button size="sm" onClick={handleGenerate}>생성</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={handleClose}>닫기</Button>
              <Button variant="outline" size="sm" onClick={handleGenerate}>재생성</Button>
              <Button variant="outline" size="sm" onClick={handleDownloadCsv}>
                CSV 다운로드
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-500 text-white"
                onClick={handleApplyAll}
                disabled={applyPending || !!result}
              >
                {applyPending ? "적용 중…" : "전체 적용"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
