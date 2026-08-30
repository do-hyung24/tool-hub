import "server-only";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { ensureInitialized, getSql } from "./db";
import { verifyPassword } from "./password";

// 세션에는 최소한의, 자주 바뀌지 않는 식별 정보만 담는다.
// 이메일 인증 여부처럼 자주 바뀔 수 있는 값은 세션(JWT)에 캐시하지 않고,
// 필요할 때마다 lib/data.ts의 getSellerById로 DB에서 직접 조회한다.
declare module "next-auth" {
  interface User {
    nickname?: string | null;
  }
  interface Session {
    user: {
      id: string;
      nickname: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    nickname?: string | null;
  }
}

type SellerAuthRow = {
  id: string;
  email: string | null;
  nickname: string;
  password_hash: string | null;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        await ensureInitialized();
        const sql = getSql();
        const rows = (await sql`
          SELECT id, email, nickname, password_hash FROM sellers WHERE email = ${email}
        `) as SellerAuthRow[];
        const seller = rows[0];
        if (!seller || !seller.password_hash) return null;

        const valid = await verifyPassword(password, seller.password_hash);
        if (!valid) return null;

        return {
          id: seller.id,
          email: seller.email,
          name: seller.nickname,
          nickname: seller.nickname,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.nickname = user.nickname;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.nickname = token.nickname ?? "";
      }
      return session;
    },
  },
});
