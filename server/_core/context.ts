import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { parse as parseCookies } from "cookie";
import { jwtVerify } from "jose";
import { getUserByOpenId } from "../db";
import { ENV } from "./env";
import { COOKIE_NAME } from "../../shared/const";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export function canUseSession(user: Pick<User, "emailVerified"> | null, verificationEnforced: boolean) {
  return Boolean(user && (!verificationEnforced || user.emailVerified));
}

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  try {
    const cookieHeader = opts.req.headers.cookie || "";
    const cookies = parseCookies(cookieHeader);
    const token = cookies[COOKIE_NAME];
    if (token && ENV.cookieSecret) {
      const secret = new TextEncoder().encode(ENV.cookieSecret);
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ["HS256"],
        issuer: "pulseboard",
        audience: "pulseboard-web",
      });
      if (payload.openId) {
        const sessionUser = await getUserByOpenId(payload.openId as string);
        // Turning email verification on must also invalidate old, unverified sessions.
        user = canUseSession(sessionUser, ENV.emailVerificationEnforced) ? sessionUser : null;
      }
    }
  } catch {
    user = null;
  }
  return { req: opts.req, res: opts.res, user };
}
