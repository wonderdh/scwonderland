import { CategoryLayout } from "@/app/components/layout/CategoryLayout";
import { CategoryPageWrapper } from "@/app/components/layout/CategoryPageWrapper";

export default function NoticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CategoryPageWrapper>
      <CategoryLayout menuId="features" categoryTitle="Notice">
        {children}
      </CategoryLayout>
    </CategoryPageWrapper>
  );
}
