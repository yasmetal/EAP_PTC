import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * <select> ธรรมดา (ไม่ใช่ Base UI) เพื่อให้ทำงานกับ <form action={serverAction}>
 * ได้ตรงไปตรงมา 100% โดยไม่ต้องพึ่ง client JS — สำคัญสำหรับหน้าที่ใช้บนแท็บเล็ตในคลัง
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { NativeSelect };
