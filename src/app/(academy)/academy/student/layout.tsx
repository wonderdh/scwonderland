import { createClient } from "@/lib/supabase/server";
import { hasUserRole } from "@/lib/auth/user-roles";
import { redirect } from "next/navigation";
import { StudentNav } from "./components/StudentNav";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/academy/login?next=/academy/student");
  }

  const isStudent = await hasUserRole(supabase, user.id, "student");
  if (!isStudent) {
    redirect("/academy/dashboard");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <StudentNav />
      {children}
    </div>
  );
}
