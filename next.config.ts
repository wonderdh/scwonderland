import type { NextConfig } from "next";
import os from "node:os";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseHostname = supabaseUrl
  ? new URL(supabaseUrl).hostname
  : "";

/** 현재 머신의 IPv4 LAN 주소를 전부 수집 (dev 서버에서만 사용). */
function getLanIPv4Addresses(): string[] {
  const nets = os.networkInterfaces();
  const out: string[] = [];
  for (const ifaces of Object.values(nets)) {
    for (const net of ifaces ?? []) {
      if (net.family === "IPv4" && !net.internal) out.push(net.address);
    }
  }
  return out;
}

const nextConfig: NextConfig = {
  // LAN 의 다른 PC 에서 dev 서버 접근 허용. 머신의 모든 IPv4 인터페이스를 자동 등록.
  // IP 가 바뀌어도 dev 서버 재시작 시 자동 갱신.
  allowedDevOrigins: getLanIPv4Addresses(),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      // 로컬 dev 라도 DB(운영 동기화)에 저장된 표지 URL 은 운영 supabase 호스트를
      // 가리키므로, supabase.co 스토리지 public object 를 일괄 허용한다.
      {
        protocol: "https" as const,
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
