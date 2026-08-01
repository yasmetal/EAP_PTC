import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import type { RoleName } from "@/lib/permissions";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// hash คงที่สำหรับเทียบเวลาไม่มีผู้ใช้จริง (หรือบัญชีถูกล็อก) เพื่อให้เวลาตอบสนองใกล้เคียงกับ
// กรณีรหัสผ่านผิด กัน timing attack ที่ใช้เดาว่าอีเมลนี้มีอยู่ในระบบหรือไม่
const DUMMY_HASH = bcrypt.hashSync("no-such-user-timing-guard", 10);

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "อีเมล", type: "email" },
        password: { label: "รหัสผ่าน", type: "password" },
      },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === "string" ? credentials.email : undefined;
        const password = typeof credentials?.password === "string" ? credentials.password : undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { role: true },
        });

        if (!user || user.status !== "active") {
          await bcrypt.compare(password, DUMMY_HASH);
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await bcrypt.compare(password, DUMMY_HASH);
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: attempts,
              lockedUntil:
                attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
            },
          });
          return null;
        }

        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role.name as RoleName,
        };
      },
    }),
  ],
});
