import {
  listAllWeeklySentences,
  getWeeklySentenceConfig,
} from "@/app/(admin)/admin/actions";
import { WeeklySentencesManager } from "./components/WeeklySentencesManager";

export default async function AdminWeeklySentencesPage() {
  const [sentences, config] = await Promise.all([
    listAllWeeklySentences(),
    getWeeklySentenceConfig(),
  ]);
  return (
    <WeeklySentencesManager
      initialSentences={sentences}
      initialConfig={config}
    />
  );
}
