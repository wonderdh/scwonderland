"use client";

import {
  addStudentToClass,
  createClass,
  deleteClass,
  listStudentsNotInClass,
  removeStudentFromClass,
  updateClass,
} from "../../actions";
import type { ClassWithDetails, ClassStudentRow } from "@/lib/types";
import {
  assignTextbookToClass,
  removeTextbookFromClass,
  listClassTextbooks,
  listTextbooks,
  type ClassTextbook,
  type Textbook,
} from "../../actions/textbook-actions";
import type { ClassTeacherInfo } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const GROUP_ORDER = ["유치부", "오후반", ""] as const;

const MANAGE_GROUP_STYLE: Record<string, {
  icon: string;
  sectionBg: string;
  sectionText: string;
  countBg: string;
}> = {
  유치부: { icon: "🌅", sectionBg: "bg-amber-100", sectionText: "text-amber-800", countBg: "bg-amber-200 text-amber-800" },
  오후반: { icon: "☁️", sectionBg: "bg-sky-100", sectionText: "text-sky-800", countBg: "bg-sky-200 text-sky-800" },
  "": { icon: "📋", sectionBg: "bg-slate-100", sectionText: "text-slate-600", countBg: "bg-slate-200 text-slate-600" },
};

function formatTeachers(teachers: ClassTeacherInfo[]): string {
  if (teachers.length === 0) return "미지정";
  return teachers.map((t) => `${t.name ?? "—"}(${t.teacher_type === "native" ? "원어민" : "한국인"})`).join(", ");
}

function TeacherBadges({ teachers }: { teachers: ClassTeacherInfo[] }) {
  if (teachers.length === 0) return <span className="text-muted-foreground">미지정</span>;
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {teachers.map((t) => (
        <span
          key={t.profile_id}
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
            t.teacher_type === "native"
              ? "bg-blue-100 text-blue-700"
              : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {t.name ?? "—"}
        </span>
      ))}
    </span>
  );
}

type TeacherOption = { id: string; name: string; teacher_type: "korean" | "native" };

type StudentInfo = {
  id: string;
  korean_name: string | null;
  english_name: string | null;
  student_number: string | null;
};

type FlatClassStudent = {
  class_id: string;
  id: string;
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  student_number: string | null;
};

export function ClassesManager({
  initialClasses,
  teachers,
  allClassStudents,
  allStudents,
}: {
  initialClasses: ClassWithDetails[];
  teachers: TeacherOption[];
  allClassStudents: FlatClassStudent[];
  allStudents: StudentInfo[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editClass, setEditClass] = useState<ClassWithDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassWithDetails | null>(null);
  const [addStudentOpen, setAddStudentOpen] = useState<ClassWithDetails | null>(null);
  const [removeStudentTarget, setRemoveStudentTarget] =
    useState<{ classId: string; row: ClassStudentRow } | null>(null);

  // 오른쪽 패널 모드
  const [rightMode, setRightMode] = useState<"students" | "textbooks">("students");
  const [rightSearch, setRightSearch] = useState("");

  // 오른쪽 패널: 전체 교재 목록
  const [allTextbooks, setAllTextbooks] = useState<Textbook[]>([]);
  const [allTextbooksLoaded, setAllTextbooksLoaded] = useState(false);

  // 왼쪽 카드: per-class textbooks
  const [cardTextbooks, setCardTextbooks] = useState<Record<string, ClassTextbook[]>>({});
  const [cardTextbooksLoaded, setCardTextbooksLoaded] = useState<Record<string, boolean>>({});

  // 드래그 앤 드롭: 호버 중인 카드
  const [dropTargetClassId, setDropTargetClassId] = useState<string | null>(null);

  // 알림 토스트
  const [notification, setNotification] = useState<{ type: "error" | "success"; message: string } | null>(null);

  const studentsByClassId = useMemo(() => {
    const map: Record<string, ClassStudentRow[]> = {};
    for (const s of allClassStudents) {
      if (!map[s.class_id]) map[s.class_id] = [];
      map[s.class_id].push({
        id: s.id,
        student_profile_id: s.student_profile_id,
        korean_name: s.korean_name,
        english_name: s.english_name,
        student_number: s.student_number,
      });
    }
    return map;
  }, [allClassStudents]);

  // 학생의 소속 반 정보
  const studentClassMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const cs of allClassStudents) {
      if (!map[cs.student_profile_id]) map[cs.student_profile_id] = [];
      const cls = initialClasses.find((c) => c.id === cs.class_id);
      if (cls) map[cs.student_profile_id].push(cls.name);
    }
    return map;
  }, [allClassStudents, initialClasses]);

  // 왼쪽 패널 검색 필터 (방과후 제외)
  const filteredClasses = useMemo(() => {
    const nonAfterschool = initialClasses.filter((c) => c.group_label !== "방과후");
    let result =
      groupFilter === "all"
        ? nonAfterschool
        : nonAfterschool.filter((c) => (c.group_label ?? "") === groupFilter);
    if (!search.trim()) return result;
    const q = search.trim().toLowerCase();
    return result.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.group_label && c.group_label.toLowerCase().includes(q)) return true;
      const students = studentsByClassId[c.id] ?? [];
      return students.some(
        (s) =>
          (s.korean_name && s.korean_name.toLowerCase().includes(q)) ||
          (s.english_name && s.english_name.toLowerCase().includes(q)) ||
          (s.student_number && s.student_number.toLowerCase().includes(q))
      );
    });
  }, [initialClasses, search, groupFilter, studentsByClassId]);

  const groupedFilteredClasses = useMemo(() => {
    const map = new Map<string, ClassWithDetails[]>([
      ["유치부", []],
      ["오후반", []],
      ["", []],
    ]);
    for (const c of filteredClasses) {
      const key = c.group_label ?? "";
      map.get(key)!.push(c);
    }
    return map;
  }, [filteredClasses]);

  // 오른쪽 패널: 학생 검색 필터
  const filteredRightStudents = useMemo(() => {
    if (!rightSearch.trim()) return allStudents;
    const q = rightSearch.trim().toLowerCase();
    return allStudents.filter(
      (s) =>
        (s.korean_name && s.korean_name.toLowerCase().includes(q)) ||
        (s.english_name && s.english_name.toLowerCase().includes(q)) ||
        (s.student_number && s.student_number.toLowerCase().includes(q))
    );
  }, [allStudents, rightSearch]);

  // 오른쪽 패널: 교재 검색 필터
  const filteredRightTextbooks = useMemo(() => {
    if (!rightSearch.trim()) return allTextbooks;
    const q = rightSearch.trim().toLowerCase();
    return allTextbooks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.series && t.series.toLowerCase().includes(q)) ||
        (t.level && `lv.${t.level}`.includes(q))
    );
  }, [allTextbooks, rightSearch]);

  // 교재 목록 로드
  const loadAllTextbooks = useCallback(async () => {
    const data = await listTextbooks();
    setAllTextbooks(data);
    setAllTextbooksLoaded(true);
  }, []);

  useEffect(() => {
    if (rightMode === "textbooks" && !allTextbooksLoaded) {
      loadAllTextbooks();
    }
  }, [rightMode, allTextbooksLoaded, loadAllTextbooks]);

  // 왼쪽 카드: per-class 교재 로드
  const loadCardTextbooks = useCallback(async (classId: string) => {
    const data = await listClassTextbooks(classId);
    setCardTextbooks((prev) => ({ ...prev, [classId]: data }));
    setCardTextbooksLoaded((prev) => ({ ...prev, [classId]: true }));
  }, []);

  useEffect(() => {
    if (rightMode === "textbooks") {
      for (const c of initialClasses) {
        if (!cardTextbooksLoaded[c.id]) {
          loadCardTextbooks(c.id);
        }
      }
    }
  }, [rightMode, initialClasses, cardTextbooksLoaded, loadCardTextbooks]);

  // 알림 자동 해제
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // 교재 제거 (왼쪽 카드)
  const handleRemoveTextbookFromCard = async (classId: string, textbookId: string) => {
    await removeTextbookFromClass(classId, textbookId);
    loadCardTextbooks(classId);
    router.refresh();
  };

  // 드롭 핸들러: 학생을 카드에 드롭
  const handleDropStudentToCard = async (classId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDropTargetClassId(null);

    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.type !== "student") return;

    const { studentProfileId } = parsed;

    // 이미 이 반에 있는지 확인
    const existing = studentsByClassId[classId] ?? [];
    if (existing.some((s) => s.student_profile_id === studentProfileId)) {
      setNotification({ type: "error", message: "이미 이 반에 소속된 학생입니다." });
      return;
    }

    // 다른 반에 소속되어 있으면 기존 반에서 제거
    const currentEntry = allClassStudents.find(
      (cs) => cs.student_profile_id === studentProfileId
    );
    if (currentEntry) {
      await removeStudentFromClass(currentEntry.id);
    }

    await addStudentToClass(classId, studentProfileId);
    const studentName = allStudents.find((s) => s.id === studentProfileId);
    const name = studentName?.korean_name ?? studentName?.english_name ?? "학생";
    const targetClassName = initialClasses.find((c) => c.id === classId)?.name ?? "";
    if (currentEntry) {
      const fromClassName = initialClasses.find((c) => c.id === currentEntry.class_id)?.name ?? "";
      setNotification({ type: "success", message: `${name}: ${fromClassName} → ${targetClassName}` });
    } else {
      setNotification({ type: "success", message: `${name}이(가) ${targetClassName}에 추가되었습니다.` });
    }
    router.refresh();
  };

  // 드롭 핸들러: 교재를 카드에 드롭
  const handleDropTextbookToCard = async (classId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDropTargetClassId(null);

    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.type !== "textbook") return;

    const { textbookId } = parsed;

    // 이미 배정되어 있는지 확인
    const existing = cardTextbooks[classId] ?? [];
    if (existing.some((ct) => ct.textbook_id === textbookId)) {
      setNotification({ type: "error", message: "이미 이 반에 배정된 교재입니다." });
      return;
    }

    const result = await assignTextbookToClass(classId, textbookId);
    if (result?.error) {
      setNotification({ type: "error", message: result.error });
      return;
    }
    loadCardTextbooks(classId);
    setNotification({ type: "success", message: "교재가 배정되었습니다." });
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* 알림 토스트 */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 shadow-lg text-sm font-medium transition-all ${
            notification.type === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "error" ? (
              <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            ) : (
              <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            )}
            {notification.message}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">반 관리</h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 shadow-sm"
        >
          + 반 추가
        </button>
      </div>

      {/* 좌우 분할 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* ===== 왼쪽 패널: 반 카드 목록 ===== */}
        <div className="space-y-3">
          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <svg className="size-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="search"
                placeholder="반 이름 · 학생 이름 · 학번 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-input px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground bg-background"
              />
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="rounded-lg border border-input px-2.5 py-1.5 text-sm text-foreground bg-background shrink-0"
              >
                <option value="all">전체</option>
                <option value="유치부">🌅 유치부</option>
                <option value="오후반">☁️ 오후반</option>
                <option value="">미지정</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              {rightMode === "students"
                ? "오른쪽에서 학생을 드래그하여 반에 추가하세요"
                : "오른쪽에서 교재를 드래그하여 반에 배정하세요"}
            </p>
          </div>

          <div className="space-y-2 max-h-[calc(100vh-240px)] overflow-y-auto pr-1">
            {filteredClasses.length === 0 ? (
              <div className="rounded-xl border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                {search.trim() || groupFilter !== "all" ? "검색 결과가 없습니다." : "등록된 반이 없습니다. 반 추가로 생성하세요."}
              </div>
            ) : (
              GROUP_ORDER.map((group) => {
                const groupClasses = groupedFilteredClasses.get(group) ?? [];
                if (groupClasses.length === 0) return null;
                const style = MANAGE_GROUP_STYLE[group];
                const label = group || "미지정";
                return (
                  <div key={group} className="space-y-2">
                    <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${style.sectionBg}`}>
                      <span className="text-sm leading-none">{style.icon}</span>
                      <span className={`text-xs font-semibold ${style.sectionText}`}>{label}</span>
                      <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${style.countBg}`}>
                        {groupClasses.length}개
                      </span>
                    </div>
                    <div className="space-y-3 pl-1">
                      {groupClasses.map((c) => (
                        <ClassCard
                          key={c.id}
                          classRow={c}
                          students={studentsByClassId[c.id] ?? []}
                          globalMode={rightMode}
                          textbooks={cardTextbooks[c.id] ?? []}
                          textbooksLoaded={cardTextbooksLoaded[c.id] ?? false}
                          onEdit={() => setEditClass(c)}
                          onDelete={() => setDeleteTarget(c)}
                          onRemoveStudent={(row) =>
                            setRemoveStudentTarget({ classId: c.id, row })
                          }
                          onRemoveTextbook={(textbookId) =>
                            handleRemoveTextbookFromCard(c.id, textbookId)
                          }
                          isDropTarget={dropTargetClassId === c.id}
                          onDragOver={() => setDropTargetClassId(c.id)}
                          onDragLeave={() => setDropTargetClassId(null)}
                          onDrop={(e) =>
                            rightMode === "students"
                              ? handleDropStudentToCard(c.id, e)
                              : handleDropTextbookToCard(c.id, e)
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ===== 오른쪽 패널: 학생/교재 소스 목록 ===== */}
        <div className="lg:sticky lg:top-6 self-start space-y-3">
          <div className="rounded-xl border-2 border-primary/30 bg-card overflow-hidden shadow-sm">
            {/* 모드 토글 헤더 */}
            <div className="flex border-b">
              <button
                type="button"
                onClick={() => { setRightMode("students"); setRightSearch(""); }}
                className={`flex-1 px-4 py-2.5 text-sm font-semibold transition-colors ${
                  rightMode === "students"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                  </svg>
                  학생 관리
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setRightMode("textbooks"); setRightSearch(""); }}
                className={`flex-1 px-4 py-2.5 text-sm font-semibold transition-colors ${
                  rightMode === "textbooks"
                    ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                  교재 관리
                </span>
              </button>
            </div>

            <div className="p-4 space-y-3">
              {rightMode === "students" ? (
                <>
                  {/* ===== 학생 목록 ===== */}
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">전체 학생</h3>
                    <span className="text-xs text-muted-foreground">{allStudents.length}명</span>
                  </div>
                  <input
                    type="search"
                    placeholder="이름 · 학번 검색"
                    value={rightSearch}
                    onChange={(e) => setRightSearch(e.target.value)}
                    className="w-full rounded-lg border border-input px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    학생을 드래그하여 왼쪽 반에 추가하세요
                  </p>

                  <div className="max-h-[calc(100vh-360px)] overflow-y-auto space-y-0.5 rounded-xl border border-muted p-1.5">
                    {filteredRightStudents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <svg className="size-8 text-muted-foreground/30 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>
                        <p className="text-sm text-muted-foreground">
                          {rightSearch.trim() ? "검색 결과가 없습니다." : "등록된 학생이 없습니다."}
                        </p>
                      </div>
                    ) : (
                      filteredRightStudents.map((s) => {
                        const classes = studentClassMap[s.id];
                        return (
                          <div
                            key={s.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData(
                                "application/json",
                                JSON.stringify({ type: "student", studentProfileId: s.id })
                              );
                            }}
                            className="flex items-center gap-2 text-sm cursor-grab active:cursor-grabbing rounded-lg px-2.5 py-1.5 hover:bg-muted/50 transition-colors"
                          >
                            <svg className="w-3 h-3 text-muted-foreground/40 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                              <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                              <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
                            </svg>
                            <span className="text-foreground text-xs min-w-0 truncate">
                              {[s.korean_name, s.english_name].filter(Boolean).join(" / ") || "—"}
                            </span>
                            {s.student_number && (
                              <span className="font-mono text-muted-foreground text-xs shrink-0">
                                {s.student_number}
                              </span>
                            )}
                            <span className="ml-auto shrink-0">
                              {classes && classes.length > 0 ? (
                                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                                  {classes.join(", ")}
                                </span>
                              ) : (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                  미배정
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* ===== 교재 목록 ===== */}
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">전체 교재</h3>
                    <span className="text-xs text-muted-foreground">
                      {allTextbooksLoaded ? `${allTextbooks.length}권` : "…"}
                    </span>
                  </div>
                  <input
                    type="search"
                    placeholder="교재명 · 시리즈 · 레벨 검색"
                    value={rightSearch}
                    onChange={(e) => setRightSearch(e.target.value)}
                    className="w-full rounded-lg border border-input px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    교재를 드래그하여 왼쪽 반에 배정하세요
                  </p>

                  <div className="max-h-[calc(100vh-360px)] overflow-y-auto space-y-0.5 rounded-xl border border-muted p-1.5">
                    {!allTextbooksLoaded ? (
                      <div className="flex items-center justify-center py-8">
                        <p className="text-sm text-muted-foreground">불러오는 중…</p>
                      </div>
                    ) : filteredRightTextbooks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <svg className="size-8 text-muted-foreground/30 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                        </svg>
                        <p className="text-sm text-muted-foreground">
                          {rightSearch.trim() ? "검색 결과가 없습니다." : "등록된 교재가 없습니다."}
                        </p>
                      </div>
                    ) : (
                      filteredRightTextbooks.map((t) => (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData(
                              "application/json",
                              JSON.stringify({ type: "textbook", textbookId: t.id })
                            );
                          }}
                          className="flex items-center gap-2 text-sm cursor-grab active:cursor-grabbing rounded-lg px-2.5 py-1.5 hover:bg-muted/50 transition-colors"
                        >
                          <svg className="w-3 h-3 text-muted-foreground/40 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                            <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                            <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
                          </svg>
                          <span className="text-foreground text-xs min-w-0 truncate">{t.title}</span>
                          <div className="flex items-center gap-1.5 ml-auto shrink-0">
                            {t.series && (
                              <span className="text-[10px] text-muted-foreground">{t.series}</span>
                            )}
                            {t.level && (
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                                Lv.{t.level}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground/70">
                              {t.total_units}단원
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 모달들 */}
      {createOpen && (
        <AddClassModal
          teachers={teachers}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            setCreateOpen(false);
            toast.success("반이 생성되었습니다.");
            router.refresh();
          }}
        />
      )}
      {editClass && (
        <EditClassModal
          classRow={editClass}
          teachers={teachers}
          onClose={() => setEditClass(null)}
          onSuccess={() => {
            setEditClass(null);
            toast.success("반이 수정되었습니다.");
            router.refresh();
          }}
        />
      )}
      {addStudentOpen && (
        <AddStudentModal
          classId={addStudentOpen.id}
          onClose={() => setAddStudentOpen(null)}
          onSuccess={() => {
            setAddStudentOpen(null);
            router.refresh();
          }}
        />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="반 삭제"
          message={`"${deleteTarget.name}" 반을 삭제하면 소속 학생 정보만 해제됩니다. 삭제할까요?`}
          confirmLabel="삭제"
          variant="danger"
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await deleteClass(deleteTarget.id);
            setDeleteTarget(null);
            toast.success("반이 삭제되었습니다.");
            router.refresh();
          }}
        />
      )}
      {removeStudentTarget && (
        <ConfirmModal
          title="학생 제외"
          message="이 반에서 해당 학생을 제외할까요?"
          confirmLabel="제외"
          variant="danger"
          onClose={() => setRemoveStudentTarget(null)}
          onConfirm={async () => {
            await removeStudentFromClass(removeStudentTarget.row.id);
            setRemoveStudentTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/* ===== 왼쪽 반 카드 ===== */
function ClassCard({
  classRow,
  students,
  globalMode,
  textbooks,
  textbooksLoaded,
  onEdit,
  onDelete,
  onRemoveStudent,
  onRemoveTextbook,
  isDropTarget,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  classRow: ClassWithDetails;
  students: ClassStudentRow[];
  globalMode: "students" | "textbooks";
  textbooks: ClassTextbook[];
  textbooksLoaded: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRemoveStudent: (row: ClassStudentRow) => void;
  onRemoveTextbook: (textbookId: string) => void;
  isDropTarget: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      className={`rounded-xl border-2 bg-card overflow-hidden transition-all ${
        isDropTarget
          ? globalMode === "students"
            ? "border-emerald-400 bg-emerald-50/30 shadow-md"
            : "border-blue-400 bg-blue-50/30 shadow-md"
          : "border-border"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver();
      }}
      onDragLeave={() => onDragLeave()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(e);
      }}
    >
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground text-sm">{classRow.name}</span>
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
            {classRow.student_count}명
          </span>
          {isDropTarget && (
            <span className={`text-xs font-medium animate-pulse ${
              globalMode === "students" ? "text-emerald-600" : "text-blue-600"
            }`}>
              여기에 놓기
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">
            담당: <TeacherBadges teachers={classRow.teachers} />
          </span>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            수정
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive hover:bg-destructive/20"
          >
            삭제
          </button>
        </div>
      </div>

      {/* 콘텐츠 - globalMode에 따라 학생 또는 교재 표시 */}
      <div className="px-4 py-2.5">
        {globalMode === "students" ? (
          students.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">
              {isDropTarget ? "여기에 학생을 놓으세요" : "소속 학생 없음"}
            </p>
          ) : (
            <ul className="space-y-1">
              {students.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 text-sm rounded-lg px-2 py-1 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-foreground text-xs">
                    {[s.korean_name, s.english_name].filter(Boolean).join(" / ") || "—"}
                    {s.student_number && (
                      <span className="ml-1.5 font-mono text-muted-foreground text-xs">
                        {s.student_number}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveStudent(s)}
                    className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive hover:bg-destructive/20"
                  >
                    제외
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : !textbooksLoaded ? (
          <p className="text-xs text-muted-foreground py-2 text-center">불러오는 중…</p>
        ) : textbooks.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">
            {isDropTarget ? "여기에 교재를 놓으세요" : "배정된 교재 없음"}
          </p>
        ) : (
          <ul className="space-y-1">
            {textbooks.map((ct) => (
              <li
                key={ct.id}
                className="flex items-center justify-between gap-2 text-sm rounded-lg px-2 py-1 hover:bg-muted/50 transition-colors"
              >
                <span className="text-foreground text-xs">
                  {ct.textbook_title}
                  {ct.textbook_level && (
                    <span className="ml-1.5 text-muted-foreground">
                      Lv.{ct.textbook_level}
                    </span>
                  )}
                  <span className="ml-1.5 text-muted-foreground/70">
                    {ct.total_units}단원
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveTextbook(ct.textbook_id)}
                  className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive hover:bg-destructive/20"
                >
                  제거
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ===== 모달 컴포넌트들 ===== */

function AddClassModal({
  teachers,
  onClose,
  onSuccess,
}: {
  teachers: TeacherOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [groupLabel, setGroupLabel] = useState("");
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTeacher = (id: string) => {
    setSelectedTeacherIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  };

  const filteredTeachers = useMemo(() => {
    if (!teacherSearch.trim()) return teachers;
    const q = teacherSearch.trim().toLowerCase();
    return teachers.filter((t) => t.name.toLowerCase().includes(q));
  }, [teachers, teacherSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await createClass(name.trim(), selectedTeacherIds, groupLabel);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onSuccess();
  };

  return (
    <Modal title="반 추가" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              반 이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-input px-3 py-2 text-foreground bg-background"
              placeholder="예: 토요 1반"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              그룹
            </label>
            <select
              value={groupLabel}
              onChange={(e) => setGroupLabel(e.target.value)}
              className="w-full rounded-lg border border-input px-3 py-2 text-foreground bg-background"
            >
              <option value="">미지정</option>
              <option value="유치부">유치부</option>
              <option value="오후반">오후반</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            담당 선생님 <span className="text-muted-foreground font-normal">(최대 2명)</span>
          </label>
          <input
            type="search"
            placeholder="선생님 이름 검색"
            value={teacherSearch}
            onChange={(e) => setTeacherSearch(e.target.value)}
            className="w-full rounded-lg border border-input px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground bg-background mb-2"
          />
          <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg border border-input p-2">
            {filteredTeachers.map((t) => (
              <label
                key={t.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${
                  selectedTeacherIds.includes(t.id) ? "bg-primary/10" : "hover:bg-muted/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTeacherIds.includes(t.id)}
                  onChange={() => toggleTeacher(t.id)}
                  disabled={!selectedTeacherIds.includes(t.id) && selectedTeacherIds.length >= 2}
                  className="rounded"
                />
                <span className="text-sm text-foreground">{t.name}</span>
                <span className={`ml-auto rounded px-1.5 py-0.5 text-xs font-medium ${
                  t.teacher_type === "native" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {t.teacher_type === "native" ? "원어민" : "한국인"}
                </span>
              </label>
            ))}
            {teachers.length === 0 && (
              <p className="text-xs text-muted-foreground py-2 text-center">등록된 교사가 없습니다.</p>
            )}
            {teachers.length > 0 && filteredTeachers.length === 0 && (
              <p className="text-xs text-muted-foreground py-2 text-center">검색 결과 없음</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditClassModal({
  classRow,
  teachers,
  onClose,
  onSuccess,
}: {
  classRow: ClassWithDetails;
  teachers: TeacherOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(classRow.name);
  const [groupLabel, setGroupLabel] = useState(classRow.group_label ?? "");
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>(
    classRow.teachers.map((t) => t.profile_id)
  );
  const [teacherSearch, setTeacherSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTeacher = (id: string) => {
    setSelectedTeacherIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  };

  const filteredTeachers = useMemo(() => {
    if (!teacherSearch.trim()) return teachers;
    const q = teacherSearch.trim().toLowerCase();
    return teachers.filter((t) => t.name.toLowerCase().includes(q));
  }, [teachers, teacherSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await updateClass(
      classRow.id,
      name.trim(),
      selectedTeacherIds,
      groupLabel,
    );
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onSuccess();
  };

  return (
    <Modal title="반 수정" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              반 이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-input px-3 py-2 text-foreground bg-background"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              그룹
            </label>
            <select
              value={groupLabel}
              onChange={(e) => setGroupLabel(e.target.value)}
              className="w-full rounded-lg border border-input px-3 py-2 text-foreground bg-background"
            >
              <option value="">미지정</option>
              <option value="유치부">유치부</option>
              <option value="오후반">오후반</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            담당 선생님 <span className="text-muted-foreground font-normal">(최대 2명)</span>
          </label>
          <input
            type="search"
            placeholder="선생님 이름 검색"
            value={teacherSearch}
            onChange={(e) => setTeacherSearch(e.target.value)}
            className="w-full rounded-lg border border-input px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground bg-background mb-2"
          />
          <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg border border-input p-2">
            {filteredTeachers.map((t) => (
              <label
                key={t.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${
                  selectedTeacherIds.includes(t.id) ? "bg-primary/10" : "hover:bg-muted/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTeacherIds.includes(t.id)}
                  onChange={() => toggleTeacher(t.id)}
                  disabled={!selectedTeacherIds.includes(t.id) && selectedTeacherIds.length >= 2}
                  className="rounded"
                />
                <span className="text-sm text-foreground">{t.name}</span>
                <span className={`ml-auto rounded px-1.5 py-0.5 text-xs font-medium ${
                  t.teacher_type === "native" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {t.teacher_type === "native" ? "원어민" : "한국인"}
                </span>
              </label>
            ))}
            {teachers.length > 0 && filteredTeachers.length === 0 && (
              <p className="text-xs text-muted-foreground py-2 text-center">검색 결과 없음</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddStudentModal({
  classId,
  onClose,
  onSuccess,
}: {
  classId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [options, setOptions] = useState<
    {
      id: string;
      korean_name: string | null;
      english_name: string | null;
      student_number: string | null;
    }[]
  >([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listStudentsNotInClass(classId).then((list) => {
      setOptions(list);
      setLoading(false);
    });
  }, [classId]);

  const filteredOptions = useMemo(() => {
    if (!studentSearch.trim()) return options;
    const q = studentSearch.trim().toLowerCase();
    return options.filter(
      (s) =>
        (s.korean_name && s.korean_name.toLowerCase().includes(q)) ||
        (s.english_name && s.english_name.toLowerCase().includes(q)) ||
        (s.student_number && s.student_number.toLowerCase().includes(q))
    );
  }, [options, studentSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setPending(true);
    setError(null);
    const result = await addStudentToClass(classId, selectedId);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onSuccess();
  };

  return (
    <Modal title="학생 추가" onClose={onClose}>
      {loading ? (
        <p className="py-4 text-center text-sm text-muted-foreground">불러오는 중…</p>
      ) : options.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          이 반에 추가할 수 있는 학생이 없습니다.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              학생 검색
            </label>
            <input
              type="search"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="이름 또는 학번으로 검색"
              className="w-full rounded-lg border border-input px-3 py-2 text-foreground placeholder-muted-foreground bg-background"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              학생 선택
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-lg border border-input px-3 py-2 text-foreground bg-background"
              required
            >
              <option value="">선택하세요</option>
              {filteredOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {[s.korean_name, s.english_name].filter(Boolean).join(" / ")} (
                  {s.student_number ?? "—"})
                </option>
              ))}
            </select>
            {studentSearch && filteredOptions.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">검색 결과 없음</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {pending ? "추가 중…" : "추가"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-xl border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="닫기"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  variant,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  variant: "danger" | "primary";
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-sm rounded-xl border bg-card p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            취소
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await onConfirm();
              setPending(false);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              variant === "danger"
                ? "bg-red-600 hover:bg-red-500"
                : "bg-emerald-600 hover:bg-emerald-500"
            }`}
          >
            {pending ? "처리 중…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
