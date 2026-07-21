import { redirect } from "next/navigation";

// 루트는 진입점 역할만. 인증·역할 분기는 /dashboard 가 전담한다.
// (추후 랜딩 페이지를 붙이면 이 자리를 교체하면 됨)
export default function RootPage() {
  redirect("/dashboard");
}
