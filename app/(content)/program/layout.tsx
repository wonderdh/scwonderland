import { CategoryLayout } from "@/app/components/layout/CategoryLayout";
import { CategoryPageWrapper } from "@/app/components/layout/CategoryPageWrapper";

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
