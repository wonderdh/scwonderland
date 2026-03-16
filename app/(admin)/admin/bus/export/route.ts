import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getWeeklyDropoffExportData } from "../../actions/bus-actions";
import type { DropoffExportRow, DropoffExportData } from "@/lib/types";

const DAY_NAMES = ["월", "화", "수", "목", "금"];

// ── 나이별 배경색 (ARGB) ──
function getAgeFill(age: number | null): string {
  if (age === 5) return "FFFCE7F3"; // pink-100
  if (age === 6) return "FFE0F2FE"; // sky-100
  if (age === 7) return "FFD1FAE5"; // emerald-100
  return "FFF1F5F9";                // slate-100
}

// ── 요일별 컬럼 색 ──
const DAY_COLORS: { header: string; data: string }[] = [
  { header: "FFE0E7FF", data: "FFF5F7FF" }, // 월: indigo
  { header: "FFFDE68A", data: "FFFEF9E7" }, // 화: amber
  { header: "FFA7F3D0", data: "FFF0FDF9" }, // 수: emerald
  { header: "FFE9D5FF", data: "FFFAF5FF" }, // 목: violet
  { header: "FFFECACA", data: "FFFEF2F2" }, // 금: red
];

function argbToExcelFill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

async function buildStudentScheduleSheet(
  wb: ExcelJS.Workbook,
  rows: DropoffExportRow[],
  allStudents: DropoffExportData["unassigned"],
  afterschoolEnrollments: DropoffExportData["afterschoolEnrollments"]
) {
  // 방과후 여부 빠른 조회용 Set: "profile_id:day"
  const afterschoolSet = new Set(
    afterschoolEnrollments.map((e) => `${e.profile_id}:${e.day}`)
  );
  const ws = wb.addWorksheet("하원표");

  // ── 학생별 데이터 구성 ──
  type DayEntry = { slotLabel: string; slotTime: string; stopName: string };
  type StudentEntry = {
    profile_id: string;
    korean_name: string | null;
    age: number | null;
    days: Map<number, DayEntry[]>;
  };

  const studentMap = new Map<string, StudentEntry>();
  for (const s of allStudents) {
    if (!studentMap.has(s.profile_id)) {
      studentMap.set(s.profile_id, {
        profile_id: s.profile_id,
        korean_name: s.korean_name,
        age: s.age,
        days: new Map(),
      });
    }
  }
  for (const r of rows) {
    if (!studentMap.has(r.profile_id)) {
      studentMap.set(r.profile_id, {
        profile_id: r.profile_id,
        korean_name: r.korean_name,
        age: r.age,
        days: new Map(),
      });
    }
    const stu = studentMap.get(r.profile_id)!;
    if (!stu.days.has(r.day)) stu.days.set(r.day, []);
    stu.days.get(r.day)!.push({
      slotLabel: r.slotLabel,
      slotTime: r.slotTime,
      stopName: r.stopName || "미지정",
    });
  }

  // 나이순 → 이름순
  const students = [...studentMap.values()].sort((a, b) => {
    const ageA = a.age ?? 999;
    const ageB = b.age ?? 999;
    if (ageA !== ageB) return ageA - ageB;
    return (a.korean_name ?? "").localeCompare(b.korean_name ?? "", "ko");
  });

  // ── 컬럼 정의 (요일당 2칸: 위치 + 시간) ──
  ws.columns = [
    { width: 10 },
    { width: 22 }, { width: 8 },   // 월
    { width: 22 }, { width: 8 },   // 화
    { width: 22 }, { width: 8 },   // 수
    { width: 22 }, { width: 8 },   // 목
    { width: 22 }, { width: 8 },   // 금
  ];

  // ── Row 1: 요일 헤더 ──
  const headerRow = ws.addRow(["이름", "월", "", "화", "", "수", "", "목", "", "금", ""]);
  headerRow.height = 22;

  const nameHCell = headerRow.getCell(1);
  nameHCell.value = "이름";
  nameHCell.font = { bold: true, size: 11 };
  nameHCell.fill = argbToExcelFill("FFE2E8F0");
  nameHCell.alignment = { horizontal: "center", vertical: "middle" };
  nameHCell.border = { bottom: { style: "medium", color: { argb: "FF94A3B8" } } };

  for (let d = 0; d < 5; d++) {
    const col = 2 + d * 2; // 1-indexed
    const cell = headerRow.getCell(col);
    cell.value = DAY_NAMES[d];
    cell.font = { bold: true, size: 12 };
    cell.fill = argbToExcelFill(DAY_COLORS[d].header);
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      left: { style: "medium", color: { argb: "FF94A3B8" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
    const c2 = headerRow.getCell(col + 1);
    c2.fill = argbToExcelFill(DAY_COLORS[d].header);
    c2.border = { bottom: { style: "thin", color: { argb: "FFD1D5DB" } } };
    ws.mergeCells(1, col, 1, col + 1);
  }

  // ── Row 2: 서브 헤더 ──
  const subRow = ws.addRow(["", "위치", "시간", "위치", "시간", "위치", "시간", "위치", "시간", "위치", "시간"]);
  subRow.height = 16;

  const nameSubCell = subRow.getCell(1);
  nameSubCell.fill = argbToExcelFill("FFE2E8F0");
  nameSubCell.border = { bottom: { style: "medium", color: { argb: "FF94A3B8" } } };

  for (let d = 0; d < 5; d++) {
    const col = 2 + d * 2;
    for (let ci = 0; ci < 2; ci++) {
      const cell = subRow.getCell(col + ci);
      cell.font = { bold: true, size: 9, color: { argb: "FF475569" } };
      cell.fill = argbToExcelFill(DAY_COLORS[d].header);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        left: ci === 0 ? { style: "medium", color: { argb: "FF94A3B8" } } : { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "medium", color: { argb: "FF94A3B8" } },
      };
    }
  }

  // 이름 열 2행 병합
  ws.mergeCells(1, 1, 2, 1);

  // ── 데이터 행 ──
  let prevAge: number | null | undefined = undefined;

  for (const s of students) {
    const isNewAgeGroup = prevAge === undefined || s.age !== prevAge;
    prevAge = s.age;
    const ageFill = getAgeFill(s.age);

    const rowValues: (string | number)[] = [s.korean_name ?? ""];
    for (let day = 1; day <= 5; day++) {
      const entries = s.days.get(day);
      if (!entries?.length) {
        rowValues.push("", "");
      } else {
        rowValues.push(
          entries.map((e) => e.stopName).join("\n"),
          entries.map((e) => e.slotTime).join("\n")
        );
      }
    }

    const dataRow = ws.addRow(rowValues);
    dataRow.height = 22;

    // 이름 셀
    const nameCell = dataRow.getCell(1);
    nameCell.font = { bold: true };
    nameCell.fill = argbToExcelFill(ageFill);
    nameCell.alignment = { horizontal: "center", vertical: "middle" };
    nameCell.border = {
      top: isNewAgeGroup ? { style: "medium", color: { argb: "FF64748B" } } : { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    };

    // 요일 데이터 셀
    for (let d = 0; d < 5; d++) {
      const col = 2 + d * 2;
      const isAfterSchool = afterschoolSet.has(`${s.profile_id}:${d + 1}`);
      // 방과후 요일: 헤더색(진함) + 굵은 좌측 테두리 / 일반: 연한 데이터색
      const cellFill = isAfterSchool ? DAY_COLORS[d].header : DAY_COLORS[d].data;
      const leftBorder = { style: "medium" as const, color: { argb: "FF94A3B8" } };

      for (let ci = 0; ci < 2; ci++) {
        const cell = dataRow.getCell(col + ci);
        const isEmpty = !cell.value || cell.value === "";
        cell.fill = argbToExcelFill(isEmpty ? "FFFFF5F5" : cellFill);
        cell.font = isEmpty
          ? { color: { argb: "FFCBD5E1" }, size: 9 }
          : isAfterSchool
          ? { bold: true, size: 10 }
          : { size: 10 };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        const redBorder = { style: "thin" as const, color: { argb: "FFEF4444" } };
        const normalTop = isNewAgeGroup ? { style: "medium" as const, color: { argb: "FF64748B" } } : { style: "thin" as const, color: { argb: "FFE2E8F0" } };
        cell.border = isEmpty ? {
          left: ci === 0 ? { style: "medium" as const, color: { argb: "FFEF4444" } } : redBorder,
          right: redBorder,
          top: normalTop,
          bottom: redBorder,
        } : {
          left: ci === 0 ? leftBorder : { style: "thin", color: { argb: "FFE2E8F0" } },
          top: normalTop,
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      }
    }
  }
}

async function buildUnassignedSheet(
  wb: ExcelJS.Workbook,
  unassigned: DropoffExportData["unassigned"]
) {
  const ws = wb.addWorksheet("미배정");

  ws.columns = [
    { header: "이름", width: 10 },
    { header: "나이", width: 6 },
    { header: "월", width: 6 },
    { header: "화", width: 6 },
    { header: "수", width: 6 },
    { header: "목", width: 6 },
    { header: "금", width: 6 },
  ];

  // 헤더 스타일
  const headerRow = ws.getRow(1);
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = argbToExcelFill("FFE2E8F0");
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "medium", color: { argb: "FF94A3B8" } } };
  });

  type StudentRow = {
    profile_id: string;
    korean_name: string | null;
    age: number | null;
    unassignedDays: Set<number>;
  };
  const map = new Map<string, StudentRow>();
  for (const u of unassigned) {
    if (!map.has(u.profile_id)) {
      map.set(u.profile_id, {
        profile_id: u.profile_id,
        korean_name: u.korean_name,
        age: u.age,
        unassignedDays: new Set(),
      });
    }
    map.get(u.profile_id)!.unassignedDays.add(u.day);
  }

  const students = [...map.values()].sort((a, b) => {
    const ageA = a.age ?? 999;
    const ageB = b.age ?? 999;
    if (ageA !== ageB) return ageA - ageB;
    return (a.korean_name ?? "").localeCompare(b.korean_name ?? "", "ko");
  });

  for (const s of students) {
    const ageFill = getAgeFill(s.age);
    const dataRow = ws.addRow([
      s.korean_name ?? "",
      s.age ?? "",
      s.unassignedDays.has(1) ? "✗" : "○",
      s.unassignedDays.has(2) ? "✗" : "○",
      s.unassignedDays.has(3) ? "✗" : "○",
      s.unassignedDays.has(4) ? "✗" : "○",
      s.unassignedDays.has(5) ? "✗" : "○",
    ]);

    dataRow.eachCell((cell, colNum) => {
      cell.fill = argbToExcelFill(ageFill);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      if (colNum >= 3 && cell.value === "✗") {
        cell.font = { bold: true, color: { argb: "FFDC2626" } };
      }
    });
  }
}

export async function GET() {
  const result = await getWeeklyDropoffExportData();
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const { rows, unassigned, afterschoolEnrollments } = result;

  // 전체 학생 목록 (배정 + 미배정 합산, 중복 제거)
  const seenProfileIds = new Set<string>();
  const assignedStudents = rows
    .filter((r) => !seenProfileIds.has(r.profile_id) && seenProfileIds.add(r.profile_id) !== undefined)
    .map((r) => ({
      day: 0,
      profile_id: r.profile_id,
      korean_name: r.korean_name,
      english_name: r.english_name,
      age: r.age,
    }));
  const unassignedIds = new Set(unassigned.map((u) => u.profile_id));
  const extraStudents = assignedStudents.filter((s) => !unassignedIds.has(s.profile_id));
  const allStudents = [...unassigned, ...extraStudents];

  const wb = new ExcelJS.Workbook();
  await buildStudentScheduleSheet(wb, rows, allStudents, afterschoolEnrollments);
  await buildUnassignedSheet(wb, unassigned);

  const buffer = await wb.xlsx.writeBuffer();

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="dropoff_${today}.xlsx"`,
    },
  });
}
