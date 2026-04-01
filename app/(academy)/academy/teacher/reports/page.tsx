import { getCurrentTeacherProfile, getTeacherClasses } from "../../actions";
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

  const isReadOnly = profile?.teacher_type === "korean";

  return (
    <TeacherReportClient
      classes={classes}
      initialClassId={params.class ?? null}
      isReadOnly={isReadOnly}
    />
  );
}
