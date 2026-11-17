import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1),
});

/**
 * NextAuth-Konfiguration.
 * - Login per E-Mail + Passwort (bcrypt), Sitzung als signiertes JWT.
 * - Rolle und Mandant (organizationId) werden ins Token geschrieben, damit jede
 *   Server-Komponente ohne zusätzliche DB-Abfrage den Mandanten kennt.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 }, // 12 Stunden
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "E-Mail",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          include: { organization: { select: { name: true } } },
        });
        // Konstante Laufzeit: Auch bei unbekanntem Nutzer einen Hash vergleichen.
        const hash = user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
        const ok = await bcrypt.compare(parsed.data.password, hash);
        if (!user || !ok || !user.isActive) return null;

        await db.$transaction([
          db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
          db.auditLog.create({
            data: {
              organizationId: user.organizationId,
              userId: user.id,
              action: "auth.login",
              entityType: "user",
              entityId: user.id,
            },
          }),
        ]);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          organizationName: user.organization.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.organizationName = user.organizationName;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.uid,
        name: token.name ?? "",
        email: token.email ?? "",
        role: token.role,
        organizationId: token.organizationId,
        organizationName: token.organizationName,
      };
      return session;
    },
  },
};
