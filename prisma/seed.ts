import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ROLE_PERMISSIONS } from "../src/lib/permissions";

const prisma = new PrismaClient();

const SEED_PASSWORD = "password123";

const SEED_USERS = [
  { role: "WAREHOUSE_STAFF", name: "สมชาย หยิบแพ็ค", email: "warehouse@eap-ptc.local" },
  { role: "ADMIN_CS", name: "สมหญิง แอดมิน", email: "admin@eap-ptc.local" },
  { role: "SUPERVISOR", name: "สมศักดิ์ หัวหน้าคลัง", email: "supervisor@eap-ptc.local" },
  { role: "ACCOUNTING", name: "สมใจ บัญชี", email: "accounting@eap-ptc.local" },
  { role: "OWNER", name: "สมปอง เจ้าของ", email: "owner@eap-ptc.local" },
];

async function main() {
  const roles = await Promise.all(
    Object.entries(ROLE_PERMISSIONS).map(([name, permissions]) =>
      prisma.role.upsert({
        where: { name },
        update: { permissions },
        create: { name, permissions },
      })
    )
  );
  const roleIdByName = Object.fromEntries(roles.map((r) => [r.name, r.id]));

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  await Promise.all(
    SEED_USERS.map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: { name: u.name, roleId: roleIdByName[u.role] },
        create: {
          name: u.name,
          email: u.email,
          passwordHash,
          roleId: roleIdByName[u.role],
        },
      })
    )
  );

  const merchant = await prisma.merchant.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "ร้านค้าตัวอย่าง จำกัด",
      contactEmail: "contact@example-merchant.local",
      contactPhone: "081-234-5678",
      billingTerms: "ค่าบริการ pick/pack 15 บาท/ออเดอร์, ค่าฝากสินค้า 2 บาท/ชิ้น/เดือน",
      status: "active",
    },
  });

  const products = await Promise.all(
    [
      { sku: "SKU-001", name: "เสื้อยืดสีขาว ไซส์ M", barcode: "8850000000011", weightKg: 0.2, category: "เสื้อผ้า" },
      { sku: "SKU-002", name: "กางเกงยีนส์ ไซส์ 32", barcode: "8850000000028", weightKg: 0.5, category: "เสื้อผ้า" },
      { sku: "SKU-003", name: "แก้วเก็บความเย็น 500ml", barcode: "8850000000035", weightKg: 0.4, category: "ของใช้ทั่วไป" },
    ].map((p) =>
      prisma.product.upsert({
        where: { merchantId_sku: { merchantId: merchant.id, sku: p.sku } },
        update: {},
        create: { ...p, merchantId: merchant.id },
      })
    )
  );

  const locations = await Promise.all(
    [
      { zone: "A", aisle: "01", binCode: "A-01-01", type: "picking" },
      { zone: "A", aisle: "01", binCode: "A-01-02", type: "picking" },
      { zone: "B", aisle: "02", binCode: "B-02-01", type: "picking" },
    ].map((l) =>
      prisma.location.upsert({
        where: { binCode: l.binCode },
        update: {},
        create: l,
      })
    )
  );

  await Promise.all([
    prisma.inventory.upsert({
      where: { productId_locationId: { productId: products[0].id, locationId: locations[0].id } },
      update: {},
      create: { productId: products[0].id, locationId: locations[0].id, quantity: 100, lastCountedAt: new Date() },
    }),
    prisma.inventory.upsert({
      where: { productId_locationId: { productId: products[1].id, locationId: locations[1].id } },
      update: {},
      create: { productId: products[1].id, locationId: locations[1].id, quantity: 50, lastCountedAt: new Date() },
    }),
    prisma.inventory.upsert({
      where: { productId_locationId: { productId: products[2].id, locationId: locations[2].id } },
      update: {},
      create: { productId: products[2].id, locationId: locations[2].id, quantity: 75, lastCountedAt: new Date() },
    }),
  ]);

  console.log("Seed complete.");
  console.log("Login password for all seed users:", SEED_PASSWORD);
  console.table(SEED_USERS.map((u) => ({ role: u.role, email: u.email })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
