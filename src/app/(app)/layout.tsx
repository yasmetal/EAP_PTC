import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canRead, ROLE_LABELS, type ModuleKey, type RoleName } from "@/lib/permissions";
import { BrandLockup } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { signOutAction } from "./actions";

const NAV_ITEMS: { href: string; label: string; module?: ModuleKey }[] = [
  { href: "/dashboard", label: "แดชบอร์ด" },
  { href: "/merchants", label: "ลูกค้า (Merchant)", module: "merchants" },
  { href: "/products", label: "สินค้า", module: "products" },
  { href: "/inventory", label: "สต็อกสินค้า", module: "inventory" },
  { href: "/inbound", label: "รับสินค้าเข้า", module: "inbound" },
  { href: "/orders", label: "ออเดอร์", module: "orders" },
  { href: "/pick-pack", label: "หยิบ-แพ็คสินค้า", module: "pickpack" },
  { href: "/returns", label: "การคืนสินค้า", module: "returns" },
  { href: "/billing", label: "ใบแจ้งหนี้/บิล", module: "billing" },
  { href: "/reports", label: "รายงาน", module: "reports" },
  { href: "/activity-log", label: "ประวัติการทำงาน", module: "activityLog" },
  { href: "/settings/users", label: "ผู้ใช้งานระบบ", module: "users" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const role = session.user.role as RoleName;
  const visibleNav = NAV_ITEMS.filter((item) => !item.module || canRead(role, item.module));

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <aside className="border-b bg-sidebar text-sidebar-foreground md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="px-4 py-3 md:py-4">
          <Link href="/dashboard" className="block rounded-md">
            <BrandLockup subtitle={ROLE_LABELS[role]} priority />
          </Link>
        </div>
        <nav className="flex flex-wrap gap-1 px-2 pb-3 md:flex-col md:pb-4">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t px-4 py-3 md:mt-4">
          <p className="mb-2 truncate text-xs text-muted-foreground">{session.user.email}</p>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm" className="w-full">
              ออกจากระบบ
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden p-4 md:p-8">{children}</main>
    </div>
  );
}
