import { CategoryLayout } from "@/app/components/layout/CategoryLayout";
import { CategoryPageWrapper } from "@/app/components/layout/CategoryPageWrapper";

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CategoryPageWrapper>
      <CategoryLayout menuId="gallery" categoryTitle="Community">
        {children}
      </CategoryLayout>
    </CategoryPageWrapper>
  );
}
