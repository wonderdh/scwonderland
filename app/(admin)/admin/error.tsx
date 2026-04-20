"use client";

import { ErrorScreen } from "@/components/feedback/ErrorScreen";

export default function AdminError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorScreen {...props} logTag="[AdminError]" title="관리자 페이지 오류" />;
}
