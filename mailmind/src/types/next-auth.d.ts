import type { Role } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      organizationId: string;
      organizationName: string;
    };
  }
  interface User {
    id: string;
    role: Role;
    organizationId: string;
    organizationName: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: Role;
    organizationId: string;
    organizationName: string;
  }
}
