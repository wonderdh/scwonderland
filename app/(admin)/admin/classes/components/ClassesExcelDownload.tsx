"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ClassWithDetails } from "@/lib/types";

// CLASS_COLOR_PALETTE -100/-800 계열 ARGB
const PALETTE_ARGB: { bg: string; text: string; lightBg: string }[] = [
  { bg: "FFDBEAFE", text: "FF1E40AF", lightBg: "FFEFF6FF" }, // blue
  { bg: "FFD1FAE5", text: "FF065F46", lightBg: "FFF0FDF4" }, // emerald
  { bg: "FFEDE9FE", text: "FF5B21B6", lightBg: "FFF5F3FF" }, // violet
  { bg: "FFFEF3C7", text: "FF92400E", lightBg: "FFFFFBEB" }, // amber
  { bg: "FFFFE4E6", text: "FF9F1239", lightBg: "FFFFF1F2" }, // rose
  { bg: "FFCFFAFE", text: "FF155E75", lightBg: "FFECFEFF" }, // cyan
  { bg: "FFFFEDD5", text: "FF9A3412", lightBg: "FFFFF7ED" }, // orange
  { bg: "FFCCFBF1", text: "FF115E59", lightBg: "FFF0FDFA" }, // teal
];

function getPalette(colorIndex: number | null, fallback: number) {
  const idx = (colorIndex ?? fallback) % PALETTE_ARGB.length;
  return PALETTE_ARGB[idx];
}

type FlatClassStudent = {
  class_id: string;
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
};

const HEADER_ARGB = "FF1E293B"; // slate-800
const COLS = [
  { header: "반",     key: "class",   width: 18 },
  { header: "이름",   key: "korean",  width: 14 },
  { header: "영어이름", key: "english", width: 18 },
];

async function buildWorkbook(
  classes: ClassWithDetails[],
  studentsByClass: Map<string, FlatClassStudent[]>
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();

  const nonAfterClasses = classes.filter((c) => c.group_label !== "방과후");
  const groups: { name: string; classes: ClassWithDetails[] }[] = [
    { name: "Sheet1", classes: nonAfterClasses },
    { name: "Sheet2", classes: nonAfterClasses.filter((c) => c.group_label === "유치부") },
    { name: "Sheet3", classes: nonAfterClasses.filter((c) => c.group_label === "오후반") },
  ];

  for (const { name, classes: sheetClasses } of groups) {
    const ws = wb.addWorksheet(name);
    ws.columns = COLS.map((c) => ({ header: c.header, key: c.key, width: c.width }));

    // 컬럼 헤더 행 스타일
    ws.getRow(1).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_ARGB } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    ws.getRow(1).height = 20;

    sheetClasses.forEach((cls, clsIdx) => {
      const students = studentsByClass.get(cls.id) ?? [];
      const palette = getPalette(cls.color_index, clsIdx);

      // 반 헤더 행
      const headerRow = ws.addRow({ class: cls.name, korean: "", english: "" });
      headerRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.bg } };
        cell.font = { bold: true, color: { argb: palette.text }, size: 10 };
        cell.alignment = { vertical: "middle" };
      });
      headerRow.height = 20;

      if (students.length === 0) {
        const emptyRow = ws.addRow({ class: "", korean: "(학생 없음)", english: "" });
        emptyRow.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.lightBg } };
          cell.font = { color: { argb: "FF94A3B8" }, italic: true, size: 10 };
          cell.alignment = { vertical: "middle" };
        });
        emptyRow.height = 17;
      } else {
        students.forEach((s) => {
          const row = ws.addRow({
            class: "",
            korean: s.korean_name ?? "",
            english: s.english_name ?? "",
          });
          row.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.lightBg } };
            cell.alignment = { vertical: "middle" };
            cell.font = { size: 10 };
          });
          row.height = 17;
        });
      }
    });
  }

  return wb;
}

export function ClassesExcelDownload({
  classes,
  allClassStudents,
}: {
  classes: ClassWithDetails[];
  allClassStudents: FlatClassStudent[];
}) {
  const [pending, setPending] = useState(false);

  const handleDownload = async () => {
    setPending(true);
    try {
      const studentsByClass = new Map<string, FlatClassStudent[]>();
      for (const s of allClassStudents) {
        const list = studentsByClass.get(s.class_id) ?? [];
        list.push(s);
        studentsByClass.set(s.class_id, list);
      }

      const wb = await buildWorkbook(classes, studentsByClass);
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "반별_학생명단.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPending(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={pending}>
      {pending ? "준비 중…" : "명단 엑셀 다운로드"}
    </Button>
  );
}
