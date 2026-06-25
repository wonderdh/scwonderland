"use client";

import { ErrorScreen } from "@/components/feedback/ErrorScreen";

/**
 * 루트 레이아웃 자체가 크래시했을 때의 최후 방어선.
 * (라우트별 error.tsx 는 레이아웃 내부 오류만 잡는다. global-error 는 자체 <html> 필요.)
 */
export default function RootGlobalError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body>
        <ErrorScreen {...props} logTag="[RootGlobalError]" />
      </body>
    </html>
  );
}
