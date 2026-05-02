import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "버스 동승",
};

export const viewport: Viewport = {
  themeColor: "#1e293b",
};

// 버스 기사 도메인은 신 스키마(user_role enum)에서 "bus" 역할이 제거되고
// bus_staff 테이블도 사라져 현재 비활성화 상태입니다.
// 도메인 재도입 결정 전까지는 학원 포털로 리다이렉트.
export default async function BusLayout(_props: {
  children: React.ReactNode;
}) {
  redirect("/academy/dashboard");
}
