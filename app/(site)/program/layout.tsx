import { CategoryLayout } from "@/app/(site)/_components/layout/CategoryLayout";
import { CategoryPageWrapper } from "@/app/(site)/_components/layout/CategoryPageWrapper";

export default function ProgramLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CategoryPageWrapper>
      <CategoryLayout menuId="programs" categoryTitle="Program">
        {children}
      </CategoryLayout>
    </CategoryPageWrapper>
  );
}
