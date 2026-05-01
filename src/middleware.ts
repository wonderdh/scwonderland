import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|sc-wonderland-logo|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf|css|js|map)$).*)",
  ],
};

export function middleware(req: NextRequest) {
  if (process.env.MAINTENANCE_MODE === "off") {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  if (pathname === "/maintenance") {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/maintenance";
  return NextResponse.rewrite(url, { status: 503 });
}
