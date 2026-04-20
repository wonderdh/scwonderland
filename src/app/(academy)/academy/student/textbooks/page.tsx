import { getCurrentStudentTextbooks } from "../../actions";
import { StudentTextbooksClient } from "./StudentTextbooksClient";

export default async function StudentTextbooksPage() {
  const textbooks = await getCurrentStudentTextbooks();
  return <StudentTextbooksClient textbooks={textbooks} />;
}
