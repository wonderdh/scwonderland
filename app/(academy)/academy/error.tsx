"use client";

import { ErrorScreen } from "@/components/feedback/ErrorScreen";

export default function AcademyError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorScreen {...props} logTag="[AcademyError]" />;
}
