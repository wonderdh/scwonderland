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
  listTextbooksNotInClass,
  type ClassTextbook,
  type Textbook,
} from "../../actions/textbook-actions";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type TeacherOption = { id: string; name: string };

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
  const [createOpen, setCreateOpen] = useState(false);
  const [editClass, setEditClass] = useState<ClassWithDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassWithDetails | null>(null);
  const [addStudentOpen, setAddStudentOpen] = useState<ClassWithDetails | null>(null);
  const [removeStudentTarget, setRemoveStudentTarget] =
    useState<{ classId: string; row: ClassStudentRow } | null>(null);

  // 오른쪽 패널: 대상 반
  const [rightMode, setRightMode] = useState<"students" | "textbooks">("students");
  const [targetClassId, setTargetClassId] = useState<string>("");
  const [targetSearch, setTargetSearch] = useState("");
  const [isDropOver, setIsDropOver] = useState(false);

  // 오른쪽 패널: 교재 관리 모드
  const [targetTextbooks, setTargetTextbooks] = useState<ClassTextbook[]>([]);
  const [targetTextbooksLoaded, setTargetTextbooksLoaded] = useState(false);
  const [textbookSearch, setTextbookSearch] = useState("");
  const [addTextbookToTarget, setAddTextbookToTarget] = useState(false);

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

  // 미배정 학생 (어떤 반에도 속하지 않은 학생)
  const unassignedStudents = useMemo(() => {
    const assignedIds = new Set(allClassStudents.map((s) => s.student_profile_id));
    return allStudents.filter((s) => !assignedIds.has(s.id));
  }, [allStudents, allClassStudents]);

  // 왼쪽 패널 검색 필터
  const filteredClasses = useMemo(() => {
    if (!search.trim()) return initialClasses;
    const q = search.trim().toLowerCase();
    return initialClasses.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      const students = studentsByClassId[c.id] ?? [];
      return students.some(
        (s) =>
          (s.korean_name && s.korean_name.toLowerCase().includes(q)) ||
          (s.english_name && s.english_name.toLowerCase().includes(q)) ||
          (s.student_number && s.student_number.toLowerCase().includes(q))
      );
    });
  }, [initialClasses, search, studentsByClassId]);

  const filteredUnassigned = useMemo(() => {
    if (!search.trim()) return unassignedStudents;
    const q = search.trim().toLowerCase();
    return unassignedStudents.filter(
      (s) =>
        (s.korean_name && s.korean_name.toLowerCase().includes(q)) ||
        (s.english_name && s.english_name.toLowerCase().includes(q)) ||
        (s.student_number && s.student_number.toLowerCase().includes(q))
    );
  }, [unassignedStudents, search]);

  // 대상 반 정보
  const targetClass = initialClasses.find((c) => c.id === targetClassId) ?? null;
  const targetStudents = targetClassId ? studentsByClassId[targetClassId] ?? [] : [];

  // 대상 반 학생 검색 필터
  const filteredTargetStudents = useMemo(() => {
    if (!targetSearch.trim()) return targetStudents;
    const q = targetSearch.trim().toLowerCase();
    return targetStudents.filter(
      (s) =>
        (s.korean_name && s.korean_name.toLowerCase().includes(q)) ||
        (s.english_name && s.english_name.toLowerCase().includes(q)) ||
        (s.student_number && s.student_number.toLowerCase().includes(q))
    );
  }, [targetStudents, targetSearch]);

  // 교재 관리 모드: 대상 반 변경 시 교재 로드
  const loadTargetTextbooks = useCallback(async (classId: string) => {
    if (!classId) return;
    const data = await listClassTextbooks(classId);
    setTargetTextbooks(data);
    setTargetTextbooksLoaded(true);
  }, []);

  useEffect(() => {
    if (rightMode === "textbooks" && targetClassId) {
      setTargetTextbooksLoaded(false);
      loadTargetTextbooks(targetClassId);
    }
  }, [rightMode, targetClassId, loadTargetTextbooks]);

  const filteredTargetTextbooks = useMemo(() => {
    if (!textbookSearch.trim()) return targetTextbooks;
    const q = textbookSearch.trim().toLowerCase();
    return targetTextbooks.filter(
      (t) =>
        t.textbook_title.toLowerCase().includes(q) ||
        (t.textbook_series && t.textbook_series.toLowerCase().includes(q)) ||
        (t.textbook_level && `lv.${t.textbook_level}`.includes(q))
    );
  }, [targetTextbooks, textbookSearch]);

  const handleRemoveTextbookFromTarget = async (textbookId: string) => {
    if (!targetClassId) return;
    await removeTextbookFromClass(targetClassId, textbookId);
    loadTargetTextbooks(targetClassId);
    router.refresh();
  };

  // 드래그 앤 드롭: 학생을 대상 반으로 이동
  const handleDropToTarget = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropOver(false);
    if (!targetClassId) return;

    const data = e.dataTransfer.getData("application/json");
    if (!data) return;

    const { studentProfileId, fromClassId, classStudentId } = JSON.parse(data);

    if (fromClassId === targetClassId) return;

    // 기존 반에서 제거 (반이 있는 경우)
    if (classStudentId) {
      await removeStudentFromClass(classStudentId);
    }
    // 대상 반에 추가
    await addStudentToClass(targetClassId, studentProfileId);
    router.refresh();
  };

  // 드래그 앤 드롭: 반 카드 간 이동 (기존 기능 유지)
  const [cardDropTarget, setCardDropTarget] = useState<string | null>(null);

  const handleDropToCard = async (toClassId: string, e: React.DragEvent) => {
    e.preventDefault();
    setCardDropTarget(null);

    const data = e.dataTransfer.getData("application/json");
    if (!data) return;

    const { studentProfileId, fromClassId, classStudentId } = JSON.parse(data);
    if (fromClassId === toClassId) return;

    if (classStudentId) {
      await removeStudentFromClass(classStudentId);
    }
    await addStudentToClass(toClassId, studentProfileId);
    router.refresh();
  };

  return (
    <div className="space-y-4">
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
        {/* ===== 왼쪽 패널: 전체 반 + 미배정 학생 ===== */}
        <div className="space-y-3">
          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2 mb-3">
              <svg className="size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="search"
                placeholder="반 이름 · 학생 이름 · 학번 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 rounded-lg border border-input px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground bg-background"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              학생을 드래그하여 오른쪽 대상 반으로 이동할 수 있습니다
            </p>
          </div>

          <div className="space-y-3 max-h-[calc(100vh-240px)] overflow-y-auto pr-1">
            {/* 반 카드 목록 */}
            {filteredClasses.map((c) => (
              <ClassCard
                key={c.id}
                classRow={c}
                students={studentsByClassId[c.id] ?? []}
                isTarget={c.id === targetClassId}
                onEdit={() => setEditClass(c)}
                onDelete={() => setDeleteTarget(c)}
                onAddStudent={() => setAddStudentOpen(c)}
                onRemoveStudent={(row) =>
                  setRemoveStudentTarget({ classId: c.id, row })
                }
                onSelectAsTarget={() => setTargetClassId(c.id)}
                isCardDropTarget={cardDropTarget === c.id}
                onCardDragOver={() => setCardDropTarget(c.id)}
                onCardDragLeave={() => setCardDropTarget(null)}
                onCardDrop={(e) => handleDropToCard(c.id, e)}
              />
            ))}

            {/* 미배정 학생 */}
            {filteredUnassigned.length > 0 && (
              <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 overflow-hidden">
                <div className="px-4 py-2.5 bg-amber-100/50 border-b border-amber-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-amber-800">미배정 학생</span>
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {filteredUnassigned.length}명
                    </span>
                  </div>
                </div>
                <div className="px-4 py-2.5">
                  <ul className="space-y-1">
                    {filteredUnassigned.map((s) => (
                      <li
                        key={s.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData(
                            "application/json",
                            JSON.stringify({
                              studentProfileId: s.id,
                              fromClassId: null,
                              classStudentId: null,
                            })
                          );
                        }}
                        className="flex items-center gap-1.5 text-sm cursor-grab active:cursor-grabbing rounded-lg px-2 py-1.5 hover:bg-amber-100/50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                          <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                          <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
                        </svg>
                        <span className="text-foreground">
                          {[s.korean_name, s.english_name].filter(Boolean).join(" / ") || "—"}
                        </span>
                        {s.student_number && (
                          <span className="ml-auto font-mono text-xs text-muted-foreground">
                            {s.student_number}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {filteredClasses.length === 0 && filteredUnassigned.length === 0 && (
              <div className="rounded-xl border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                {search.trim() ? "검색 결과가 없습니다." : "등록된 반이 없습니다. 반 추가로 생성하세요."}
              </div>
            )}
          </div>
        </div>

        {/* ===== 오른쪽 패널: 학생 관리 / 교재 관리 ===== */}
        <div className="lg:sticky lg:top-6 self-start space-y-3">
          <div className="rounded-xl border-2 border-primary/30 bg-card overflow-hidden shadow-sm">
            {/* 모드 토글 헤더 */}
            <div className="flex border-b">
              <button
                type="button"
                onClick={() => setRightMode("students")}
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
                onClick={() => setRightMode("textbooks")}
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
              {/* 반 선택 드롭다운 (공통) */}
              <select
                value={targetClassId}
                onChange={(e) => {
                  setTargetClassId(e.target.value);
                  setTargetSearch("");
                  setTextbookSearch("");
                  setTargetTextbooksLoaded(false);
                }}
                className="w-full rounded-lg border border-input px-3 py-2 text-sm text-foreground bg-background"
              >
                <option value="">반을 선택하세요</option>
                {initialClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({studentsByClassId[c.id]?.length ?? 0}명) — 담당: {c.teacher_name ?? "미지정"}
                  </option>
                ))}
              </select>

              {!targetClassId ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 p-10 text-center">
                  {rightMode === "students" ? (
                    <>
                      <svg className="size-10 text-muted-foreground/30 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                      </svg>
                      <p className="text-sm text-muted-foreground">위에서 반을 선택하면</p>
                      <p className="text-sm text-muted-foreground">왼쪽에서 학생을 드래그하여 추가할 수 있습니다</p>
                    </>
                  ) : (
                    <>
                      <svg className="size-10 text-muted-foreground/30 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                      </svg>
                      <p className="text-sm text-muted-foreground">위에서 반을 선택하면</p>
                      <p className="text-sm text-muted-foreground">배정된 교재 목록을 관리할 수 있습니다</p>
                    </>
                  )}
                </div>
              ) : rightMode === "students" ? (
                <>
                  {/* ===== 학생 관리 모드 ===== */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{targetClass?.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        담당: {targetClass?.teacher_name ?? "미지정"} · {targetStudents.length}명
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => targetClass && setEditClass(targetClass)}
                        className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => targetClass && setAddStudentOpen(targetClass)}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                      >
                        + 학생
                      </button>
                    </div>
                  </div>

                  {targetStudents.length > 3 && (
                    <input
                      type="search"
                      placeholder="반 내 학생 검색"
                      value={targetSearch}
                      onChange={(e) => setTargetSearch(e.target.value)}
                      className="w-full rounded-lg border border-input px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground bg-background"
                    />
                  )}

                  {/* 드롭 존 */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setIsDropOver(true);
                    }}
                    onDragLeave={() => setIsDropOver(false)}
                    onDrop={handleDropToTarget}
                    className={`rounded-xl border-2 border-dashed transition-all min-h-[200px] p-2 ${
                      isDropOver
                        ? "border-emerald-400 bg-emerald-50/50 shadow-inner"
                        : "border-muted-foreground/20 bg-muted/20"
                    }`}
                  >
                    {filteredTargetStudents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-[180px] text-center">
                        <svg className="size-8 text-muted-foreground/30 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        <p className="text-sm text-muted-foreground">
                          {isDropOver ? "여기에 놓으세요!" : "왼쪽에서 학생을 드래그하세요"}
                        </p>
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {filteredTargetStudents.map((s) => (
                          <li
                            key={s.id}
                            className="flex items-center justify-between gap-2 text-sm rounded-lg px-3 py-2 bg-card hover:bg-muted/50 transition-colors"
                          >
                            <span className="text-foreground">
                              {[s.korean_name, s.english_name].filter(Boolean).join(" / ") || "—"}
                              {s.student_number && (
                                <span className="ml-1.5 font-mono text-muted-foreground text-xs">
                                  {s.student_number}
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setRemoveStudentTarget({ classId: targetClassId, row: s })
                              }
                              className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive hover:bg-destructive/20"
                            >
                              제외
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {isDropOver && (
                    <p className="text-xs text-emerald-600 font-medium text-center animate-pulse">
                      드롭하여 학생을 추가합니다
                    </p>
                  )}
                </>
              ) : (
                <>
                  {/* ===== 교재 관리 모드 ===== */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{targetClass?.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        담당: {targetClass?.teacher_name ?? "미지정"} · 교재 {targetTextbooksLoaded ? `${targetTextbooks.length}권` : "…"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddTextbookToTarget(true)}
                      className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-500"
                    >
                      + 교재 배정
                    </button>
                  </div>

                  {/* 교재 검색 */}
                  <div className="flex items-center gap-2">
                    <svg className="size-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                    <input
                      type="search"
                      placeholder="교재명 · 시리즈 · 레벨 검색"
                      value={textbookSearch}
                      onChange={(e) => setTextbookSearch(e.target.value)}
                      className="flex-1 rounded-lg border border-input px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground bg-background"
                    />
                  </div>

                  {/* 교재 목록 */}
                  <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/30 min-h-[200px] p-2">
                    {!targetTextbooksLoaded ? (
                      <div className="flex items-center justify-center h-[180px]">
                        <p className="text-sm text-muted-foreground">불러오는 중…</p>
                      </div>
                    ) : filteredTargetTextbooks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-[180px] text-center">
                        <svg className="size-8 text-muted-foreground/30 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                        </svg>
                        <p className="text-sm text-muted-foreground">
                          {textbookSearch.trim()
                            ? "검색 결과가 없습니다."
                            : "배정된 교재가 없습니다."}
                        </p>
                        {!textbookSearch.trim() && (
                          <p className="text-xs text-muted-foreground mt-1">
                            위의 &quot;+ 교재 배정&quot; 버튼으로 교재를 추가하세요
                          </p>
                        )}
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {filteredTargetTextbooks.map((ct) => (
                          <li
                            key={ct.id}
                            className="flex items-center justify-between gap-2 text-sm rounded-lg px-3 py-2 bg-card hover:bg-muted/50 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="text-foreground text-sm">
                                {ct.textbook_title}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                {ct.textbook_series && (
                                  <span className="text-xs text-muted-foreground">
                                    {ct.textbook_series}
                                  </span>
                                )}
                                {ct.textbook_level && (
                                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                                    Lv.{ct.textbook_level}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground/70">
                                  {ct.total_units}단원
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveTextbookFromTarget(ct.textbook_id)}
                              className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive hover:bg-destructive/20 shrink-0"
                            >
                              제거
                            </button>
                          </li>
                        ))}
                      </ul>
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
            if (targetClassId === deleteTarget.id) setTargetClassId("");
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
      {addTextbookToTarget && targetClassId && (
        <AddTextbookToClassModal
          classId={targetClassId}
          onClose={() => setAddTextbookToTarget(false)}
          onSuccess={() => {
            setAddTextbookToTarget(false);
            loadTargetTextbooks(targetClassId);
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
  isTarget,
  onEdit,
  onDelete,
  onAddStudent,
  onRemoveStudent,
  onSelectAsTarget,
  isCardDropTarget,
  onCardDragOver,
  onCardDragLeave,
  onCardDrop,
}: {
  classRow: ClassWithDetails;
  students: ClassStudentRow[];
  isTarget: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddStudent: () => void;
  onRemoveStudent: (row: ClassStudentRow) => void;
  onSelectAsTarget: () => void;
  isCardDropTarget: boolean;
  onCardDragOver: () => void;
  onCardDragLeave: () => void;
  onCardDrop: (e: React.DragEvent) => void;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"students" | "textbooks">("students");
  const [textbooks, setTextbooks] = useState<ClassTextbook[]>([]);
  const [textbooksLoaded, setTextbooksLoaded] = useState(false);
  const [addTextbookOpen, setAddTextbookOpen] = useState(false);

  const loadTextbooks = useCallback(async () => {
    const data = await listClassTextbooks(classRow.id);
    setTextbooks(data);
    setTextbooksLoaded(true);
  }, [classRow.id]);

  useEffect(() => {
    if (activeTab === "textbooks" && !textbooksLoaded) {
      loadTextbooks();
    }
  }, [activeTab, textbooksLoaded, loadTextbooks]);

  const handleRemoveTextbook = async (textbookId: string) => {
    await removeTextbookFromClass(classRow.id, textbookId);
    loadTextbooks();
    router.refresh();
  };

  return (
    <div
      className={`rounded-xl border-2 bg-card overflow-hidden transition-all ${
        isTarget
          ? "border-primary/50 ring-2 ring-primary/20"
          : isCardDropTarget
          ? "border-emerald-400 bg-emerald-50/30 shadow-md"
          : "border-border"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        onCardDragOver();
      }}
      onDragLeave={() => onCardDragLeave()}
      onDrop={(e) => {
        e.preventDefault();
        onCardDrop(e);
      }}
    >
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground text-sm">{classRow.name}</span>
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
            {classRow.student_count}명
          </span>
          {isCardDropTarget && (
            <span className="text-xs text-emerald-600 font-medium">여기에 놓기</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">
            담당: {classRow.teacher_name ?? "—"}
          </span>
          <button
            type="button"
            onClick={onSelectAsTarget}
            className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20"
            title="오른쪽 대상 반으로 선택"
          >
            대상
          </button>
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

      {/* 탭 */}
      <div className="flex border-b">
        <button
          type="button"
          onClick={() => setActiveTab("students")}
          className={`flex-1 px-4 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "students"
              ? "text-foreground border-b-2 border-primary bg-card"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
        >
          학생 ({students.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("textbooks")}
          className={`flex-1 px-4 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "textbooks"
              ? "text-foreground border-b-2 border-primary bg-card"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
        >
          교재 ({textbooksLoaded ? textbooks.length : "…"})
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="px-4 py-2.5">
        {activeTab === "students" ? (
          <>
            <div className="flex justify-end mb-1.5">
              <button
                type="button"
                onClick={onAddStudent}
                className="rounded-lg bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-emerald-500"
              >
                + 학생 추가
              </button>
            </div>
            {students.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">소속 학생 없음</p>
            ) : (
              <ul className="space-y-1">
                {students.map((s) => (
                  <li
                    key={s.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData(
                        "application/json",
                        JSON.stringify({
                          studentProfileId: s.student_profile_id,
                          fromClassId: classRow.id,
                          classStudentId: s.id,
                        })
                      );
                    }}
                    className="flex items-center justify-between gap-2 text-sm cursor-grab active:cursor-grabbing rounded-lg px-2 py-1 -mx-1 hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-foreground flex items-center gap-1.5">
                      <svg className="w-3 h-3 text-muted-foreground/50 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                        <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                        <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
                      </svg>
                      <span className="text-xs">
                        {[s.korean_name, s.english_name].filter(Boolean).join(" / ") || "—"}
                      </span>
                      {s.student_number && (
                        <span className="font-mono text-muted-foreground text-xs">
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
            )}
          </>
        ) : (
          <>
            <div className="flex justify-end mb-1.5">
              <button
                type="button"
                onClick={() => setAddTextbookOpen(true)}
                className="rounded-lg bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-emerald-500"
              >
                + 교재 배정
              </button>
            </div>
            {!textbooksLoaded ? (
              <p className="text-xs text-muted-foreground py-2">불러오는 중…</p>
            ) : textbooks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">배정된 교재 없음</p>
            ) : (
              <ul className="space-y-1">
                {textbooks.map((ct) => (
                  <li
                    key={ct.id}
                    className="flex items-center justify-between gap-2 text-sm"
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
                      onClick={() => handleRemoveTextbook(ct.textbook_id)}
                      className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive hover:bg-destructive/20"
                    >
                      제거
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {addTextbookOpen && (
        <AddTextbookToClassModal
          classId={classRow.id}
          onClose={() => setAddTextbookOpen(false)}
          onSuccess={() => {
            setAddTextbookOpen(false);
            loadTextbooks();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/* ===== 모달 컴포넌트들 ===== */

function AddTextbookToClassModal({
  classId,
  onClose,
  onSuccess,
}: {
  classId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [options, setOptions] = useState<Textbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTextbooksNotInClass(classId).then((list) => {
      setOptions(list);
      setLoading(false);
    });
  }, [classId]);

  const filtered = search.trim()
    ? options.filter(
        (t) =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          (t.series && t.series.toLowerCase().includes(search.toLowerCase()))
      )
    : options;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setPending(true);
    setError(null);
    const result = await assignTextbookToClass(classId, selectedId);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onSuccess();
  };

  return (
    <Modal title="교재 배정" onClose={onClose}>
      {loading ? (
        <p className="py-4 text-center text-sm text-muted-foreground">불러오는 중…</p>
      ) : options.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          배정 가능한 교재가 없습니다. 먼저 교재 관리에서 교재를 등록하세요.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <input
            type="search"
            placeholder="교재명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-input px-3 py-2 text-sm text-foreground placeholder-muted-foreground bg-background"
          />
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-lg border border-input px-3 py-2 text-sm text-foreground bg-background"
            required
          >
            <option value="">교재를 선택하세요</option>
            {filtered.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} {t.level ? `(Lv.${t.level})` : ""} — {t.total_units}단원
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80">
              취소
            </button>
            <button type="submit" disabled={pending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
              {pending ? "배정 중…" : "배정"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

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
  const [teacherId, setTeacherId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await createClass(name.trim(), teacherId || null);
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
            담당 선생님
          </label>
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="w-full rounded-lg border border-input px-3 py-2 text-foreground bg-background"
          >
            <option value="">선택 안 함</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
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
  const [teacherId, setTeacherId] = useState(classRow.teacher_profile_id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await updateClass(
      classRow.id,
      name.trim(),
      teacherId || null
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
            담당 선생님
          </label>
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="w-full rounded-lg border border-input px-3 py-2 text-foreground bg-background"
          >
            <option value="">선택 안 함</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
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
