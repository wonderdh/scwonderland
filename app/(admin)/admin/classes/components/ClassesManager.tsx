"use client";

import {
  addStudentToClass,
  createClass,
  deleteClass,
  listStudentsNotInClass,
  removeStudentFromClass,
  updateClass,
  type ClassWithDetails,
  type ClassStudentRow,
} from "../../actions";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TeacherOption = { id: string; name: string };

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
}: {
  initialClasses: ClassWithDetails[];
  teachers: TeacherOption[];
  allClassStudents: FlatClassStudent[];
}) {
  const router = useRouter();
  const [teacherFilter, setTeacherFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editClass, setEditClass] = useState<ClassWithDetails | null>(null);
  const [addStudentOpen, setAddStudentOpen] = useState<ClassWithDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassWithDetails | null>(null);
  const [removeStudentTarget, setRemoveStudentTarget] =
    useState<{ classId: string; row: ClassStudentRow } | null>(null);

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

  const filteredClasses = useMemo(() => {
    let list = initialClasses;
    if (teacherFilter) {
      list = list.filter((c) => c.teacher_profile_id === teacherFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => {
        if (c.name.toLowerCase().includes(q)) return true;
        const students = studentsByClassId[c.id] ?? [];
        return students.some(
          (s) =>
            (s.korean_name && s.korean_name.toLowerCase().includes(q)) ||
            (s.english_name && s.english_name.toLowerCase().includes(q)) ||
            (s.student_number && s.student_number.toLowerCase().includes(q))
        );
      });
    }
    return list;
  }, [initialClasses, teacherFilter, search, studentsByClassId]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-800">반 관리</h1>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">선생님</label>
          <select
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
          >
            <option value="">전체</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">검색</label>
          <input
            type="search"
            placeholder="반 이름 또는 학생 이름·학번"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 sm:w-64"
          />
        </div>
      </div>

      {/* 반 목록 (단일 열) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-slate-600">반 목록</h2>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            반 추가
          </button>
        </div>
        {filteredClasses.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
            {initialClasses.length === 0
              ? "등록된 반이 없습니다. 반 추가로 생성하세요."
              : "검색 결과가 없습니다."}
          </div>
        ) : (
          <ul className="space-y-4">
            {filteredClasses.map((c) => (
              <li key={c.id}>
                <ClassCard
                  classRow={c}
                  students={studentsByClassId[c.id] ?? []}
                  onEdit={() => setEditClass(c)}
                  onDelete={() => setDeleteTarget(c)}
                  onAddStudent={() => setAddStudentOpen(c)}
                  onRemoveStudent={(row) =>
                    setRemoveStudentTarget({ classId: c.id, row })
                  }
                />
              </li>
            ))}
          </ul>
        )}
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

function ClassCard({
  classRow,
  students,
  onEdit,
  onDelete,
  onAddStudent,
  onRemoveStudent,
}: {
  classRow: ClassWithDetails;
  students: ClassStudentRow[];
  onEdit: () => void;
  onDelete: () => void;
  onAddStudent: () => void;
  onRemoveStudent: (row: ClassStudentRow) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">{classRow.name}</span>
          <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
            {classRow.student_count}명
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">
            담당: {classRow.teacher_name ?? "—"}
          </span>
          <button
            type="button"
            onClick={onAddStudent}
            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500"
          >
            학생 추가
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
          >
            수정
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
          >
            삭제
          </button>
        </div>
      </div>
      <div className="px-4 py-3">
        {students.length === 0 ? (
          <p className="text-sm text-slate-400">소속 학생 없음</p>
        ) : (
          <ul className="space-y-1.5">
            {students.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="text-slate-800">
                  {[s.korean_name, s.english_name].filter(Boolean).join(" / ") || "—"}
                  {s.student_number && (
                    <span className="ml-1.5 font-mono text-slate-500">
                      {s.student_number}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveStudent(s)}
                  className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-100"
                >
                  제외
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
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
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            반 이름
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
            placeholder="예: 토요 1반"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            담당 선생님
          </label>
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
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
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
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
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            반 이름
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            담당 선생님
          </label>
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
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
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
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
        <p className="py-4 text-center text-sm text-slate-500">불러오는 중…</p>
      ) : options.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">
          이 반에 추가할 수 있는 학생이 없습니다.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              학생 검색
            </label>
            <input
              type="search"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="이름 또는 학번으로 검색"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 placeholder-slate-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              학생 선택
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
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
              <p className="mt-1 text-xs text-slate-500">검색 결과 없음</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
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
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
      <div className="relative w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
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
