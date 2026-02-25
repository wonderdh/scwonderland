import { CategoryLayout } from "@/app/(site)/_components/layout/CategoryLayout";
import { CategoryPageWrapper } from "@/app/(site)/_components/layout/CategoryPageWrapper";

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
