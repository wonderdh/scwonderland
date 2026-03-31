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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, email")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "teacher") {
    redirect("/academy/dashboard");
  }

  const admin = createAdminClient();
  const { data: teacher } = await admin
    .from("teachers")
    .select("teacher_type")
    .eq("profile_id", user.id)
    .single();

  const teacherType = (teacher?.teacher_type ?? "korean") as "korean" | "native";
  const teacherName =
    profile?.first_name ??
    (profile?.email ? profile.email.split("@")[0] : null) ??
    undefined;

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
