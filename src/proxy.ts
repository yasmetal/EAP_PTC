import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { ROLE_PERMISSIONS, type ModuleKey, type RoleName } from "@/lib/permissions";

const { auth } = NextAuth(authConfig);

// Longest-prefix-first เพื่อกัน "/products" ไปแมตช์ก่อน "/products/new" โดยไม่ตั้งใจ (ไม่จำเป็นในตอนนี้ แต่กันไว้)
const ROUTE_MODULE: [string, ModuleKey][] = [
  ["/merchants", "merchants"],
  ["/products", "products"],
  ["/inbound", "inbound"],
  ["/inventory", "inventory"],
  ["/pick-pack", "pickpack"],
  ["/orders", "orders"],
  ["/returns", "returns"],
  ["/billing", "billing"],
  ["/reports", "reports"],
  ["/activity-log", "activityLog"],
  ["/settings/users", "users"],
];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isLoginPage = nextUrl.pathname === "/login";

  if (!isLoggedIn) {
    if (isLoginPage) return NextResponse.next();
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  const role = req.auth?.user?.role as RoleName | undefined;
  const matched = ROUTE_MODULE.find(([prefix]) => nextUrl.pathname.startsWith(prefix));
  if (role && matched) {
    const [, moduleKey] = matched;
    if (ROLE_PERMISSIONS[role][moduleKey] === "none") {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
