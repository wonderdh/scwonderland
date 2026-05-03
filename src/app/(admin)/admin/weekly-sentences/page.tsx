import {
  listAllWeeklySentences,
  getWeeklySentenceConfig,
} from "@/app/(admin)/admin/actions";
import { PageHeader } from "@/components/navigation/PageHeader";
import { WeeklySentencesManager } from "./_components/WeeklySentencesManager";

export default async function AdminWeeklySentencesPage() {
  const [sentences, config] = await Promise.all([
    listAllWeeklySentences(),
    getWeeklySentenceConfig(),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="주간 문장 관리"
        description="이번 주의 영어 문장(기초/중급/상급)을 등록하고 발행합니다."
      />
      <WeeklySentencesManager
        initialSentences={sentences}
        initialConfig={config}
      />
    </div>
  );
}
