import { getCurrentTeacherProfile, getTeacherClasses } from "../../actions";
import { redirect } from "next/navigation";
import { TeacherReportClient } from "../components/TeacherReportClient";

export default async function TeacherReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const [profile, classes, params] = await Promise.all([
    getCurrentTeacherProfile(),
    getTeacherClasses(),
    searchParams,
  ]);

  if (profile?.teacher_type === "korean") {
    redirect("/academy/teacher");
  }

  return (
    <TeacherReportClient
      classes={classes}
      initialClassId={params.class ?? null}
    />
  );
}
