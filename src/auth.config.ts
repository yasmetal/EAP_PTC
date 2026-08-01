import type { NextAuthConfig } from "next-auth";
import type { RoleName } from "@/lib/permissions";

/**
 * Edge-safe config shared between middleware and the full auth.ts.
 * No providers here — Credentials + Prisma/bcrypt only live in auth.ts,
 * which runs in the Node.js runtime (not edge middleware).
 */
export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: RoleName }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as RoleName;
        session.user.id = token.sub as string;
      }
      return session;
    },
  },
};
