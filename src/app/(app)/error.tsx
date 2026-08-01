"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold">เกิดข้อผิดพลาดบางอย่าง</h1>
      <p className="text-muted-foreground">
        กรุณาลองใหม่อีกครั้ง หากยังพบปัญหาต่อเนื่อง กรุณาแจ้งผู้ดูแลระบบ
      </p>
      <Button onClick={() => unstable_retry()}>ลองใหม่</Button>
    </div>
  );
}
