import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAccess, type ModuleKey } from "@/lib/permissions";

/** ใช้ใน Server Component เพื่อบังคับ login (กันซ้อนกับ middleware) */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

/**
 * ใช้ทั้งใน Server Component (guard หน้าเว็บ) และ Server Action (guard การแก้ไขข้อมูล)
 * เช็คสิทธิ์จริงฝั่ง server เสมอ ไม่พึ่งพา middleware หรือการซ่อน UI อย่างเดียว ตามสเปกข้อ 5
 * ถ้าไม่มีสิทธิ์ จะ redirect กลับไปหน้าที่ปลอดภัย แทนที่จะโยน error ตรงๆ (กัน error boundary ขึ้นเปล่าๆ)
 */
export async function requireAccess(
  moduleKey: ModuleKey,
  required: "read" | "write" = "write",
  redirectTo = "/dashboard"
) {
  const session = await requireSession();
  const access = getAccess(session.user.role, moduleKey);
  const ok = required === "write" ? access === "write" : access !== "none";
  if (!ok) redirect(redirectTo);
  return session;
}
