import { CategoryLayout } from "@/app/(site)/_components/layout/CategoryLayout";
import { CategoryPageWrapper } from "@/app/(site)/_components/layout/CategoryPageWrapper";

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
