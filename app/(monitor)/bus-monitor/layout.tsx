import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "버스 모니터",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "버스 모니터",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e293b",
};

export default function BusMonitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <head>
        <link rel="manifest" href="/manifest-bus-monitor.json" />
        <link rel="apple-touch-icon" href="/sc-wonderland-logo.png" />
      </head>
      {children}
    </>
  );
}
