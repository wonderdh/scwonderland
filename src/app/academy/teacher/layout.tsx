import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasUserRole } from "@/lib/auth/user-roles";
import { redirect } from "next/navigation";
import { TeacherNav } from "./_components/TeacherNav";
import { TeacherTypeProvider } from "./_components/TeacherTypeContext";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/academy/teacher");
  }

  const admin = createAdminClient();
  const isTeacher = await hasUserRole(admin, user.id, "teacher");
  if (!isTeacher) {
    redirect("/dashboard");
  }

  const { data: teacher } = await admin
    .from("teachers")
    .select("teacher_type, name")
    .eq("id", user.id)
    .single();

  const teacherType = (teacher?.teacher_type ?? "korean") as "korean" | "native";
  const teacherName = teacher?.name ?? undefined;

  return (
    <div className="mx-auto max-w-4xl">
      <TeacherNav
        teacherType={teacherType}
        teacherName={teacherName}
      />
      <TeacherTypeProvider teacherType={teacherType}>
        {children}
      </TeacherTypeProvider>
    </div>
  );
}
