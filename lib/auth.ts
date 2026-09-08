import "server-only";
import NextAuth, { type DefaultSession, CredentialsSignin } from "next-auth";
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
  deletion_requested_at: string | null;
};

// authorize()가 비밀번호까지 확인한 뒤 탈퇴 처리 중인 계정임을 발견하면 이 에러를 던진다.
// CredentialsSignin의 `code`는 next-auth가 그대로 보존해 호출부(app/authActions.ts의
// loginAction)까지 전달하므로, "비밀번호 틀림"과 구분되는 안내 문구를 보여줄 수 있다.
export class AccountDeletionPendingError extends CredentialsSignin {
  code = "account_deletion_pending";
}

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
          SELECT id, email, nickname, password_hash, deletion_requested_at
          FROM sellers WHERE email = ${email}
        `) as SellerAuthRow[];
        const seller = rows[0];
        if (!seller || !seller.password_hash) return null;

        const valid = await verifyPassword(password, seller.password_hash);
        if (!valid) return null;

        // 비밀번호까지 확인한 뒤에만 탈퇴 여부를 확인한다 - 그래야 이 계정이 탈퇴
        // 처리 중이라는 사실이 비밀번호를 모르는 사람에게 새어나가지 않는다.
        if (seller.deletion_requested_at) {
          throw new AccountDeletionPendingError();
        }

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
