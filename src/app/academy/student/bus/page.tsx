import { redirect } from "next/navigation";
import { getCurrentStudentProfile } from "../../actions";
import { StudentBusClient } from "./StudentBusClient";

export default async function StudentBusPage() {
  const profile = await getCurrentStudentProfile();
  if (!profile) redirect("/login");

  return <StudentBusClient studentProfileId={profile.id} />;
}
