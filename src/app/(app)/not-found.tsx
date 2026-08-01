import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold">ไม่พบข้อมูลที่ต้องการ</h1>
      <p className="text-muted-foreground">
        รายการนี้อาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง
      </p>
      <Link href="/dashboard" className={buttonVariants()}>
        กลับไปหน้าแดชบอร์ด
      </Link>
    </div>
  );
}
