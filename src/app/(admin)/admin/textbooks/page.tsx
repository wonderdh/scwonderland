import { listTextbooks } from "../actions/textbook-actions";
import { TextbooksManager } from "./components/TextbooksManager";
import { PageHeader } from "@/components/navigation/PageHeader";

export default async function AdminTextbooksPage() {
  const textbooks = await listTextbooks();

  return (
    <div className="flex flex-1 min-w-0 flex-col p-6 md:p-8">
      <PageHeader title="교재 관리" description="교재 정보와 반·학생 배정을 관리합니다." />
      <TextbooksManager initialTextbooks={textbooks} />
    </div>
  );
}
