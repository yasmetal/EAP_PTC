@AGENTS.md

# EAP_PTC — สรุปโปรเจกต์และสถานะ Production

## ภาพรวมระบบ
ERP คลังสินค้า/fulfillment ภาษาไทย สำหรับใช้งานภายในองค์กร ครอบคลุม: รับสินค้าเข้า, จัดการออเดอร์และการจอง
สต็อก, หยิบ-แพ็คด้วยบาร์โค้ด, จัดส่ง, ใบแจ้งหนี้/บิล (PDF ภาษาไทย), การคืนสินค้า, รายงาน, และ activity log
ทั้งหมดอยู่ภายใต้ระบบสิทธิ์ตามบทบาท (RBAC) 5 บทบาท (ดู `src/lib/permissions.ts`)

**Stack:** Next.js 16 (App Router, Server Actions) + TypeScript strict + PostgreSQL/Prisma +
NextAuth v5 (credentials, JWT) + Tailwind/shadcn/ui + Zod + Docker Compose (สำหรับ local dev)

## Repository
- GitHub: `yasmetal/EAP_PTC` — **เป็น public repo แล้ว** ห้าม commit secrets/credentials/connection
  string ใด ๆ ลงในโค้ดหรือเอกสารในนี้เด็ดขาด (`.env*` ถูก gitignore ไว้อยู่แล้ว)

## Production Deployment (ฟรีทั้งหมด, $0/เดือน)
- **Hosting:** Vercel — โปรเจกต์ `eap-ptc`, URL: `https://eap-ptc.vercel.app`
- **Database:** Supabase Postgres (free tier) — โปรเจกต์ `eap-ptc-prod`, ref `mckvnijkauksihwxwjaz`,
  region `ap-southeast-1`
  - ใช้ **Transaction pooler** (Supavisor, `aws-0-ap-southeast-1.pooler.supabase.com:6543`,
    user `postgres.<ref>`, `?pgbouncer=true`) เป็นค่า `DATABASE_URL` — ไม่ใช่ direct connection
    (direct connection เป็น IPv6-only บน free tier, ใช้ไม่ได้กับ network ที่ไม่รองรับ IPv6)
  - รหัสผ่าน DB **ไม่ได้เก็บไว้ที่ไหนนอกจาก Supabase dashboard และ Vercel env var `DATABASE_URL`**
    (ถูก rotate ล่าสุดผ่านหน้า Supabase Database Settings → Reset database password)
- **Env vars ที่ตั้งไว้ใน Vercel** (Production + Preview): `DATABASE_URL`, `NEXTAUTH_SECRET`
  - ไม่ต้องตั้ง `NEXTAUTH_URL` — NextAuth v5 auto-detect host จาก Vercel environment เอง
- **Build requirement:** `package.json` มี `"postinstall": "prisma generate"` — จำเป็นเพราะ Vercel
  รัน `npm install` สะอาดทุกครั้งโดยไม่มี Prisma client ที่ generate ไว้ล่วงหน้า ถ้าลบ script นี้
  build บน Vercel จะพังทันที
- **Login แรกเข้าระบบ:** มีบัญชี OWNER เดียวที่ seed ไว้ (`owner@eap-ptc.local`) รหัสผ่านถูกสร้างแบบสุ่ม
  และแจ้งให้ผู้ใช้ทราบนอกไฟล์นี้แล้ว — ควรเปลี่ยนรหัสผ่านนี้เมื่อมีหน้าจัดการผู้ใช้/เปลี่ยนรหัสผ่านพร้อมใช้งาน
- Production DB ถูก seed เฉพาะ 5 Role rows (ตรงกับ `ROLE_PERMISSIONS`) + 1 owner user เท่านั้น
  **ไม่มีข้อมูลตัวอย่าง (demo data)** เหมือนใน `prisma/seed.ts` ที่ใช้กับ local dev

## ข้อควรระวัง / gap ที่ยังไม่ได้แก้
- Migration ทั้ง 3 ไฟล์ใน `prisma/migrations/` ถูก apply เข้า production ผ่าน Supabase MCP
  (`apply_migration`, รัน SQL ตรง ๆ) **ไม่ได้ผ่าน `prisma migrate deploy`** ทำให้ตาราง
  `_prisma_migrations` บน production ไม่มีประวัติการ migrate — ถ้าจะรัน `prisma migrate deploy`
  หรือ `migrate status` กับ production ในอนาคต ต้องตรวจสอบ/sync ตารางนี้ก่อน ไม่เช่นนั้น Prisma
  อาจไม่รู้ว่า migration ไหน apply ไปแล้วบ้าง
- ทุกครั้งที่แก้ schema ต้องสร้าง migration ใหม่ (`npm run db:migrate` local) แล้ว apply เข้า
  Supabase production ด้วยมือ (ผ่าน Supabase MCP `apply_migration` หรือ dashboard SQL editor)
  เพราะ CI/CD ยังไม่ได้ผูก `prisma migrate deploy` เข้ากับ deployment pipeline

## Workflow ที่ใช้ได้ผลสำหรับงาน deploy/infra บนโปรเจกต์นี้
- Supabase เข้าถึงได้ผ่าน Supabase MCP (มี auth อยู่แล้ว) ใช้ `execute_sql`/`apply_migration`
  ได้ตรง ๆ แต่การ reset รหัสผ่าน DB (`postgres` role) ต้องทำผ่าน **Supabase dashboard**
  เท่านั้น (ALTER USER ตรง ๆ จะโดน "Only superusers can alter privileged roles")
- Vercel ไม่มี MCP ผูกไว้ — การตั้งค่า/แก้ env var และ redeploy ต้องทำผ่าน **Claude in Chrome**
  (browser ที่ login ไว้แล้วของผู้ใช้) แทนการขอให้ผู้ใช้ copy-paste ค่าต่าง ๆ เอง
