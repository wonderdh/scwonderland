import { CategoryLayout } from "@/app/components/layout/CategoryLayout";
import { CategoryPageWrapper } from "@/app/components/layout/CategoryPageWrapper";

export default function AboutWonderlandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CategoryPageWrapper>
      <CategoryLayout menuId="about" categoryTitle="About Wonderland">
        {children}
      </CategoryLayout>
    </CategoryPageWrapper>
  );
}
