import { withAuth } from "next-auth/middleware";

/**
 * Schützt alle App-Seiten und API-Routen. Öffentlich sind nur Login,
 * NextAuth-Endpunkte, Healthcheck und statische Dateien.
 */
export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/((?!login|api/auth|api/health|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
