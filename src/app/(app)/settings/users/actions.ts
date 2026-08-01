"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/require-session";
import { logActivity } from "@/lib/activity-log";
import { userCreateSchema, userUpdateSchema } from "@/lib/validation";

export async function createUser(formData: FormData) {
  const session = await requireAccess("users", "write");
  const data = userCreateSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    roleId: formData.get("roleId"),
    status: formData.get("status"),
  });

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    redirect(`/settings/users/new?error=${encodeURIComponent("อีเมลนี้มีผู้ใช้งานแล้ว")}`);
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      roleId: data.roleId,
      status: data.status,
    },
  });

  await logActivity({ userId: session.user.id, action: "CREATE", entityType: "User", entityId: user.id });

  revalidatePath("/settings/users");
  redirect(`/settings/users/${user.id}`);
}

export async function updateUser(userId: string, formData: FormData) {
  const session = await requireAccess("users", "write");
  const data = userUpdateSchema.parse({
    name: formData.get("name"),
    roleId: formData.get("roleId"),
    status: formData.get("status"),
    password: formData.get("password"),
  });

  if (userId === session.user.id && data.status === "inactive") {
    redirect(
      `/settings/users/${userId}?error=${encodeURIComponent("ไม่สามารถปิดใช้งานบัญชีของตัวเองได้")}`
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      roleId: data.roleId,
      status: data.status,
      ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 10) } : {}),
    },
  });

  await logActivity({ userId: session.user.id, action: "UPDATE", entityType: "User", entityId: userId });

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
}
