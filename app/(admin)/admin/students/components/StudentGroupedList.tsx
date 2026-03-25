"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { UserWithProfile } from "@/lib/types";
import type { updateStudentProfile, deleteUserById } from "../../actions";
import { getAgeColor } from "@/lib/student-age-colors";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type EditState = {
  korean_name: string;
  english_name: string;
  age: string;
  group_type: "" | "유치부" | "오후반";
};

function sortStudents(students: UserWithProfile[], group: string | null) {
  return [...students].sort((a, b) => {
    if (group === "유치부") {
      const ageDiff = (a.age ?? 99) - (b.age ?? 99);
      if (ageDiff !== 0) return ageDiff;
    }
    return (a.korean_name ?? a.first_name ?? "").localeCompare(
      b.korean_name ?? b.first_name ?? "",
      "ko"
    );
  });
}

function StudentRow({
  user,
  onUpdate,
  onDelete,
}: {
  user: UserWithProfile;
  onUpdate: typeof updateStudentProfile;
  onDelete: typeof deleteUserById;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [delPending, setDelPending] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id?: string; name?: string }>({ open: false });
  const [edit, setEdit] = useState<EditState>({
    korean_name: user.korean_name ?? user.first_name ?? "",
    english_name: user.english_name ?? user.last_name ?? "",
    age: user.age?.toString() ?? "",
    group_type: (user.group_type as EditState["group_type"]) ?? "",
  });

  const ageColor = getAgeColor(user.age);
  const displayName = user.korean_name ?? user.first_name ?? "—";
  const loginId = user.email?.split("@")[0] ?? "";

  const handleEdit = () => {
    setEdit({
      korean_name: user.korean_name ?? user.first_name ?? "",
      english_name: user.english_name ?? user.last_name ?? "",
      age: user.age?.toString() ?? "",
      group_type: (user.group_type as EditState["group_type"]) ?? "",
    });
    setEditing(true);
  };

  const handleCancel = () => setEditing(false);

  const handleSave = async () => {
    if (!edit.korean_name.trim()) {
      toast.error("한글 이름을 입력해 주세요.");
      return;
    }
    setPending(true);
    const form = new FormData();
    form.set("id", user.id);
    form.set("korean_name", edit.korean_name.trim());
    form.set("english_name", edit.english_name.trim());
    form.set("age", edit.age);
    form.set("group_type", edit.group_type);
    const result = await onUpdate(form);
    setPending(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("저장되었습니다.");
    setEditing(false);
    router.refresh();
  };

  const handleDeleteClick = () => {
    const name = user.korean_name ?? user.first_name ?? "이 학생";
    setDeleteConfirm({ open: true, id: user.id, name });
  };

  const handleDeleteConfirm = async () => {
    setDeleteConfirm({ open: false });
    setDelPending(true);
    const form = new FormData();
    form.set("id", user.id);
    const result = await onDelete(form);
    setDelPending(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("휴지통으로 이동되었습니다.");
    router.refresh();
  };

  if (editing) {
    return (
      <li className="px-4 py-3 bg-blue-50/60 border-b last:border-b-0 border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={edit.korean_name}
            onChange={(e) => setEdit((s) => ({ ...s, korean_name: e.target.value }))}
            placeholder="한글 이름"
            className="h-8 text-sm w-28"
          />
          <Input
            value={edit.english_name}
            onChange={(e) => setEdit((s) => ({ ...s, english_name: e.target.value }))}
            placeholder="영어 이름"
            className="h-8 text-sm w-28"
          />
          <Input
            type="number"
            value={edit.age}
            onChange={(e) => setEdit((s) => ({ ...s, age: e.target.value }))}
            placeholder="나이"
            min={3}
            max={20}
            className="h-8 text-sm w-16"
          />
          <select
            value={edit.group_type}
            onChange={(e) =>
              setEdit((s) => ({ ...s, group_type: e.target.value as EditState["group_type"] }))
            }
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">미지정</option>
            <option value="유치부">유치부</option>
            <option value="오후반">오후반</option>
          </select>
          <div className="flex gap-1.5 ml-auto">
            <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={pending}>
              {pending ? "저장 중…" : "저장"}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={handleCancel} disabled={pending}>
              취소
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="px-4 py-2.5 border-b last:border-b-0 border-slate-200 flex items-center gap-3 hover:bg-slate-50 transition-colors">
      {/* 나이 뱃지 */}
      <span
        className={`shrink-0 inline-flex items-center justify-center rounded-full w-10 h-6 text-[11px] font-semibold border ${ageColor.bg} ${ageColor.text} ${ageColor.border}`}
      >
        {user.age ? `${user.age}세` : "—"}
      </span>

      {/* 이름 · 영어이름 · 아이디 */}
      <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
        <span className="font-medium text-sm text-slate-800 shrink-0">{displayName}</span>
        {user.english_name && (
          <span className="text-xs text-slate-400 shrink-0">{user.english_name}</span>
        )}
        <span className="text-xs font-mono text-slate-300 shrink-0">{loginId}</span>
      </div>

      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs text-slate-500 shrink-0"
        onClick={handleEdit}
      >
        수정
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs text-destructive hover:text-destructive shrink-0"
        onClick={handleDeleteClick}
        disabled={delPending}
      >
        {delPending ? "…" : "삭제"}
      </Button>
      <ConfirmDialog
        open={deleteConfirm.open}
        title="삭제 확인"
        description={`${deleteConfirm.name} 학생을 삭제하시겠습니까?`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm({ open: false })}
      />
    </li>
  );
}

function GroupSection({
  title,
  students,
  color,
  onUpdate,
  onDelete,
}: {
  title: string;
  students: UserWithProfile[];
  color: string;
  onUpdate: typeof updateStudentProfile;
  onDelete: typeof deleteUserById;
}) {
  if (students.length === 0) return null;
  return (
    <div>
      <div className={`flex items-center gap-2 px-1 mb-2`}>
        <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
        <h3 className="text-sm font-semibold text-slate-700">
          {title}
          <span className="ml-1.5 text-xs font-normal text-slate-400">{students.length}명</span>
        </h3>
      </div>
      <ul className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {students.map((u) => (
          <StudentRow key={u.id} user={u} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </ul>
    </div>
  );
}

export function StudentGroupedList({
  users,
  onUpdate,
  onDelete,
}: {
  users: UserWithProfile[];
  onUpdate: typeof updateStudentProfile;
  onDelete: typeof deleteUserById;
}) {
  const kindergarten = sortStudents(
    users.filter((u) => u.group_type === "유치부"),
    "유치부"
  );
  const afternoon = sortStudents(
    users.filter((u) => u.group_type === "오후반"),
    "오후반"
  );
  const unassigned = sortStudents(
    users.filter((u) => !u.group_type),
    null
  );

  if (users.length === 0) {
    return (
      <p className="text-sm text-slate-400 py-8 text-center">등록된 학생이 없습니다.</p>
    );
  }

  return (
    <div className="space-y-6">
      <GroupSection
        title="유치부"
        students={kindergarten}
        color="bg-amber-400"
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
      <GroupSection
        title="오후반"
        students={afternoon}
        color="bg-sky-400"
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
      <GroupSection
        title="미배정"
        students={unassigned}
        color="bg-slate-300"
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </div>
  );
}
