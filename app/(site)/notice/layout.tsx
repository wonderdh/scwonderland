import { CategoryLayout } from "@/app/(site)/_components/layout/CategoryLayout";
import { CategoryPageWrapper } from "@/app/(site)/_components/layout/CategoryPageWrapper";

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
