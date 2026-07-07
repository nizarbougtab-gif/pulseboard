import type { Express } from "express";

// OAuth replaced by local email/password auth (see routers.ts auth.register / auth.login)
export function registerOAuthRoutes(_app: Express) {}
