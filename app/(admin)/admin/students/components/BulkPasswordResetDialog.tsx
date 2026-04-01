"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { UserWithProfile } from "@/lib/types";
import { bulkResetStudentPasswords, listClassesWithStudentIds } from "../../actions";

type GeneratedEntry = {
  id: string;
  name: string;
  idPrefix: string;
  password: string;
};

// CLASS_COLOR_PALETTE의 -100/-800 계열을 ARGB 헥스로 매핑
const PALETTE_ARGB: { bg: string; text: string }[] = [
  { bg: "FFDBEAFE", text: "FF1E40AF" }, // blue
  { bg: "FFD1FAE5", text: "FF065F46" }, // emerald
  { bg: "FFEDE9FE", text: "FF5B21B6" }, // violet
  { bg: "FFFEF3C7", text: "FF92400E" }, // amber
  { bg: "FFFFE4E6", text: "FF9F1239" }, // rose
  { bg: "FFCFFAFE", text: "FF155E75" }, // cyan
  { bg: "FFFFEDD5", text: "FF9A3412" }, // orange
  { bg: "FFCCFBF1", text: "FF115E59" }, // teal
];

function getPaletteArgb(colorIndex: number | null, fallback: number) {
  const idx = (colorIndex ?? fallback) % PALETTE_ARGB.length;
  return PALETTE_ARGB[idx];
}

function generatePassword(email: string): string {
  const idPrefix = email.split("@")[0];
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${idPrefix}${rand}`;
}

function getDisplayName(user: UserWithProfile, variant: "student" | "teacher"): string {
  if (variant === "teacher") return user.name ?? user.first_name ?? user.email.split("@")[0];
  return user.korean_name ?? user.first_name ?? user.email.split("@")[0];
}

export function BulkPasswordResetDialog({
  users,
  variant = "student",
}: {
  users: UserWithProfile[];
  variant?: "student" | "teacher";
}) {
  const [open, setOpen] = useState(false);
  const [generated, setGenerated] = useState<GeneratedEntry[]>([]);
  const [applyPending, setApplyPending] = useState(false);
  const [downloadPending, setDownloadPending] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  const label = variant === "teacher" ? "교사" : "학생";
  const filename = variant === "teacher" ? "교사_비밀번호.xlsx" : "학생_비밀번호.xlsx";

  const handleGenerate = () => {
    const entries = users
      .filter((u) => u.email)
      .map((u) => ({
        id: u.id,
        name: getDisplayName(u, variant),
        idPrefix: u.email.split("@")[0],
        password: generatePassword(u.email),
      }));
    setGenerated(entries);
    setResult(null);
  };

  const handleDownload = async () => {
    setDownloadPending(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();

      // ── Sheet1: 전체 목록 ──────────────────────────────
      const ws1 = wb.addWorksheet("Sheet1");
      ws1.columns = [
        { header: "이름",     key: "name",     width: 14 },
        { header: "아이디",   key: "id",       width: 16 },
        { header: "비밀번호", key: "password", width: 20 },
      ];
      // 헤더 스타일
      ws1.getRow(1).eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
      ws1.getRow(1).height = 20;
      // 데이터 행
      generated.forEach((e, i) => {
        const row = ws1.addRow({ name: e.name, id: e.idPrefix, password: e.password });
        const bgArgb = i % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC";
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
          cell.alignment = { vertical: "middle" };
        });
        row.height = 18;
      });

      // ── Sheet2: 반별 목록 (학생 전용) ──────────────────
      if (variant === "student") {
        const ws2 = wb.addWorksheet("Sheet2");
        ws2.columns = [
          { header: "반",       key: "class",    width: 16 },
          { header: "이름",     key: "name",     width: 14 },
          { header: "아이디",   key: "id",       width: 16 },
          { header: "비밀번호", key: "password", width: 20 },
        ];
        // 헤더 스타일
        ws2.getRow(1).eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
          cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
          cell.alignment = { vertical: "middle", horizontal: "center" };
        });
        ws2.getRow(1).height = 20;

        const classes = await listClassesWithStudentIds();
        const entryMap = new Map(generated.map((e) => [e.id, e]));
        const assignedIds = new Set<string>();

        classes.forEach((cls, clsIdx) => {
          const classStudents = cls.studentProfileIds
            .map((pid) => entryMap.get(pid))
            .filter((e): e is GeneratedEntry => !!e);
          if (classStudents.length === 0) return;

          const { bg, text } = getPaletteArgb(cls.colorIndex, clsIdx);

          // 반 헤더 행
          const headerRow = ws2.addRow({ class: cls.name, name: "", id: "", password: "" });
          headerRow.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
            cell.font = { bold: true, color: { argb: text }, size: 10 };
            cell.alignment = { vertical: "middle" };
          });
          headerRow.height = 20;

          // 학생 행 (반 색상 연한 배경)
          for (const e of classStudents) {
            const row = ws2.addRow({ class: "", name: e.name, id: e.idPrefix, password: e.password });
            row.eachCell((cell) => {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg + "40" } }; // ~25% opacity 근사
              cell.alignment = { vertical: "middle" };
            });
            row.height = 18;
            assignedIds.add(e.id);
          }
        });

        // 미배정 학생
        const unassigned = generated.filter((e) => !assignedIds.has(e.id));
        if (unassigned.length > 0) {
          const headerRow = ws2.addRow({ class: "미배정", name: "", id: "", password: "" });
          headerRow.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
            cell.font = { bold: true, color: { argb: "FF475569" }, size: 10 };
            cell.alignment = { vertical: "middle" };
          });
          headerRow.height = 20;
          for (const e of unassigned) {
            const row = ws2.addRow({ class: "", name: e.name, id: e.idPrefix, password: e.password });
            row.eachCell((cell) => {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
              cell.alignment = { vertical: "middle" };
            });
            row.height = 18;
          }
        }
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadPending(false);
    }
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
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">비밀번호 일괄생성</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            형식: 아이디 + 4자리 숫자 (예: gilsudong2847)
          </p>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          {generated.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <p className="text-slate-600">전체 {label} <span className="font-semibold">{users.length}명</span>의 비밀번호를 자동 생성합니다.</p>
              <p className="mt-1 text-slate-400">생성 후 엑셀 다운로드하여 확인하고, 전체 적용할 수 있습니다.</p>
              {variant === "student" && (
                <p className="mt-1 text-slate-400">Sheet1: 전체 목록 · Sheet2: 반별 색상 구분</p>
              )}
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={downloadPending}
              >
                {downloadPending ? "준비 중…" : "엑셀 다운로드"}
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
