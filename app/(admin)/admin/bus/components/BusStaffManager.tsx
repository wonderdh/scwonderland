"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BusStaffProfile, BusNumber } from "@/lib/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  createBusStaff,
  updateBusStaff,
  deleteUserById,
} from "../../actions";

export function BusStaffManager({
  busStaff,
  busNumbers,
}: {
  busStaff: BusStaffProfile[];
  busNumbers: BusNumber[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; profileId?: string; name?: string }>({ open: false });

  // 추가 폼
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newBusNumberId, setNewBusNumberId] = useState("");

  // 수정 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBusNumberId, setEditBusNumberId] = useState("");

  async function handleCreate() {
    setLoading(true);
    setError("");
    const formData = new FormData();
    formData.set("email", newEmail);
    formData.set("password", newPassword);
    formData.set("name", newName);
    if (newBusNumberId) formData.set("bus_number_id", newBusNumberId);

    const result = await createBusStaff(formData);
    if (result.error) {
      setError(result.error);
    } else {
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      setNewBusNumberId("");
      router.refresh();
    }
    setLoading(false);
  }

  async function handleUpdate(profileId: string) {
    setLoading(true);
    setError("");
    const result = await updateBusStaff(
      profileId,
      editName,
      editBusNumberId || null
    );
    if (result.error) {
      setError(result.error);
    } else {
      setEditingId(null);
      router.refresh();
    }
    setLoading(false);
  }

  function handleDeleteClick(staff: BusStaffProfile) {
    const displayName = staff.name || staff.email.split("@")[0];
    setDeleteConfirm({ open: true, profileId: staff.profile_id, name: displayName });
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirm.profileId) return;
    setDeleteConfirm({ open: false });
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.set("userId", deleteConfirm.profileId);
    const result = await deleteUserById(formData);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  const canCreate =
    newEmail.trim() && newPassword.trim() && newName.trim();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-800">버스 담당자</h3>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded">
          {error}
        </p>
      )}

      {/* 추가 폼 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="아이디"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="max-w-32"
        />
        <Input
          type="password"
          placeholder="비밀번호"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="max-w-32"
        />
        <Input
          placeholder="이름"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="max-w-28"
        />
        <select
          value={newBusNumberId}
          onChange={(e) => setNewBusNumberId(e.target.value)}
          className="h-9 px-2 border rounded text-sm w-28"
        >
          <option value="">호차 선택</option>
          {busNumbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={loading || !canCreate}
        >
          추가
        </Button>
      </div>

      {/* 목록 */}
      {busStaff.length === 0 && (
        <p className="text-xs text-slate-400 py-4">
          등록된 담당자가 없습니다.
        </p>
      )}

      <div className="space-y-1">
        {busStaff.map((staff) => {
          const isEditing = editingId === staff.profile_id;
          const loginId = staff.email.split("@")[0];

          return (
            <div
              key={staff.profile_id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              {isEditing ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="max-w-28 h-8 text-sm"
                  />
                  <select
                    value={editBusNumberId}
                    onChange={(e) => setEditBusNumberId(e.target.value)}
                    className="h-8 px-2 border rounded text-sm w-28"
                  >
                    <option value="">미배정</option>
                    {busNumbers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleUpdate(staff.profile_id)}
                    disabled={loading}
                  >
                    저장
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setEditingId(null)}
                  >
                    취소
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium w-24 truncate">
                    {staff.name}
                  </span>
                  <span className="text-xs text-slate-400 w-24 truncate">
                    {loginId}
                  </span>
                  <span className="text-sm text-slate-600 flex-1">
                    {staff.bus_label ?? "미배정"}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      setEditingId(staff.profile_id);
                      setEditName(staff.name);
                      setEditBusNumberId(staff.bus_number_id ?? "");
                    }}
                  >
                    수정
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-red-500 hover:text-red-700"
                    onClick={() => handleDeleteClick(staff)}
                    disabled={loading}
                  >
                    삭제
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={deleteConfirm.open}
        title={`"${deleteConfirm.name ?? ""}" 담당자를 삭제하시겠습니까?`}
        description="담당자 계정이 삭제되고 배정 기록에서도 제거됩니다."
        impactList={[
          "로그인 계정이 비활성화됩니다.",
          "담당 호차 배정이 미배정 상태가 됩니다.",
        ]}
        danger
        confirmLabel="삭제"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm({ open: false })}
      />
    </div>
  );
}
