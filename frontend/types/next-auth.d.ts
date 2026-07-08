import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      platformRole?: string | null;
    };
  }

  interface User {
    platformRole?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    platformRole?: string | null;
  }
}
