import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Client = PrismaClient | Prisma.TransactionClient;

export async function logActivity(
  params: { userId: string; action: string; entityType: string; entityId: string },
  client: Client = prisma
) {
  await client.activityLog.create({ data: params });
}
