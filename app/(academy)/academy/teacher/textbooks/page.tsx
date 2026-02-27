import { getCurrentTeacherProfile, getTeacherClasses, getClassTextbooks } from "../../actions";
import { TeacherTextbookClient } from "../components/TeacherTextbookClient";

export default async function TeacherTextbooksPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const [profile, classes, params] = await Promise.all([
    getCurrentTeacherProfile(),
    getTeacherClasses(),
    searchParams,
  ]);

  const initialClassId = params.class ?? classes[0]?.id ?? null;
  let initialTextbooks: Awaited<ReturnType<typeof getClassTextbooks>> = [];
  if (initialClassId) {
    initialTextbooks = await getClassTextbooks(initialClassId);
  }

  return (
    <TeacherTextbookClient
      classes={classes}
      initialClassId={initialClassId}
      initialTextbooks={initialTextbooks}
      teacherType={profile?.teacher_type ?? "korean"}
    />
  );
}
