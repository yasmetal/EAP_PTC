"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { TrackingActionState } from "@/app/(app)/orders/tracking-actions";

const INITIAL_STATE: TrackingActionState = { status: "idle" };

/**
 * ปุ่มสั่งซิงก์สถานะพัสดุ ใช้ได้ทั้งแบบรายชิ้นและแบบทั้งหมด
 * รับ action ที่ bind ค่ามาแล้วจากฝั่ง server เพื่อให้คอมโพเนนต์นี้ไม่ต้องรู้ว่ากำลังซิงก์อะไร
 */
export function TrackingRefreshButton({
  action,
  label,
  pendingLabel,
  variant = "outline",
  size = "sm",
}: {
  action: (state: TrackingActionState, formData: FormData) => Promise<TrackingActionState>;
  label: string;
  pendingLabel: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "sm" | "default";
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <Button type="submit" variant={variant} size={size} disabled={pending}>
          {pending ? pendingLabel : label}
        </Button>
      </form>

      <div aria-live="polite">
        {state.status === "error" && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.message}
          </p>
        )}
        {state.status === "success" && (
          <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            {state.message}
          </p>
        )}
      </div>
    </div>
  );
}
