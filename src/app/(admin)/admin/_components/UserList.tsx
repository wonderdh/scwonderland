import type { UserWithProfile } from "@/lib/types";
import { UserRow } from "./UserRow";

type UserListProps = {
  users: UserWithProfile[];
  roleLabel: string;
  variant: "student" | "teacher";
  onUpdate: (formData: FormData) => Promise<{ error?: string }>;
  onDelete: (formData: FormData) => Promise<{ error?: string }>;
};

export function UserList({
  users,
  roleLabel,
  variant,
  onUpdate,
  onDelete,
}: UserListProps) {
  if (users.length === 0) {
    return (
      <p className="p-4 bg-white rounded-xl border border-slate-200 text-slate-500 text-sm">
        {roleLabel}이 없습니다.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white overflow-hidden">
      {users.map((user) => (
        <UserRow
          key={user.id}
          user={user}
          variant={variant}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
