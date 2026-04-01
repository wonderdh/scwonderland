import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { TeacherNav } from "./components/TeacherNav";
import { TeacherTypeProvider } from "./components/TeacherTypeContext";

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
    redirect("/academy/login?next=/academy/teacher");
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, first_name")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/academy/login");
  }

  if (profile.role !== "teacher") {
    redirect("/academy/dashboard");
  }
  const { data: teacher } = await admin
    .from("teachers")
    .select("teacher_type")
    .eq("profile_id", user.id)
    .single();

  const teacherType = (teacher?.teacher_type ?? "korean") as "korean" | "native";
  const teacherName = profile?.first_name ?? undefined;

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
