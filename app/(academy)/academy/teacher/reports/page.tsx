import { getTeacherClasses } from "../../actions";
import { TeacherReportClient } from "../components/TeacherReportClient";

export default async function TeacherReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const [classes, params] = await Promise.all([
    getTeacherClasses(),
    searchParams,
  ]);

  return (
    <TeacherReportClient
      classes={classes}
      initialClassId={params.class ?? null}
    />
  );
}
