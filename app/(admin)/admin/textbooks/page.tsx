import { listTextbooks } from "../textbook-actions";
import { TextbooksManager } from "./components/TextbooksManager";

export default async function AdminTextbooksPage() {
  const textbooks = await listTextbooks();

  return (
    <div className="flex flex-1 min-w-0 flex-col p-6 md:p-8">
      <TextbooksManager initialTextbooks={textbooks} />
    </div>
  );
}
