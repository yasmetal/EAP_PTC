import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * โลโก้บริษัท (PTN) — ไฟล์ต้นฉบับเป็น JPG พื้นขาว จึงวางบน "ชิป" สีขาวเสมอ
 * เพื่อให้อ่านออกทั้งธีมสว่างและธีมมืด แทนที่จะปล่อยให้ขอบขาวลอยบนพื้นเข้ม
 */
export function BrandMark({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1 ring-1 ring-foreground/10",
        className
      )}
    >
      <Image
        src="/ptn-logo.jpg"
        alt="โลโก้บริษัท PTN"
        width={919}
        height={960}
        sizes="128px"
        priority={priority}
        className="size-full object-contain"
      />
    </span>
  );
}

/** โลโก้ + ชื่อระบบ ใช้ที่หัว sidebar และหน้า Login */
export function BrandLockup({
  subtitle,
  markClassName,
  className,
  priority = false,
}: {
  subtitle?: string;
  markClassName?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark className={markClassName} priority={priority} />
      <div className="min-w-0">
        <p className="truncate font-semibold leading-tight">ERP คลังสินค้า</p>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
