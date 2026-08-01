import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>ไม่พบหน้าที่ต้องการ</CardTitle>
          <CardDescription>ลิงก์อาจไม่ถูกต้อง หรือหน้านี้ถูกย้ายไปแล้ว</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard" className={buttonVariants({ className: "w-full" })}>
            กลับไปหน้าแดชบอร์ด
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
