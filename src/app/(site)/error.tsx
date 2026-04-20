"use client";

import { ErrorScreen } from "@/components/feedback/ErrorScreen";

export default function SiteError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorScreen {...props} logTag="[SiteError]" />;
}
