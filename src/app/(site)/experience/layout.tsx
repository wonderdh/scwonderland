import { CategoryLayout } from "@/app/(site)/_components/layout/CategoryLayout";
import { CategoryPageWrapper } from "@/app/(site)/_components/layout/CategoryPageWrapper";

export default function ExperienceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CategoryPageWrapper>
      <CategoryLayout menuId="contact" categoryTitle="Experience">
        {children}
      </CategoryLayout>
    </CategoryPageWrapper>
  );
}
