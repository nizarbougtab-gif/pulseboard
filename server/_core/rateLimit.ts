import type { RequestHandler } from "express";
import { logSecurityEvent } from "../db";

const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 10;

type RateLimitEntry = { count: number; resetAt: number; blockedEventLogged: boolean };

export function createIpRateLimiter(options: { onLimit?: () => void; now?: () => number; cleanup?: boolean } = {}): RequestHandler {
  const ipAttempts = new Map<string, RateLimitEntry>();
  const getNow = options.now ?? Date.now;
  if (options.cleanup !== false) {
    const cleanup = setInterval(() => {
      const now = getNow();
      for (const [key, attempt] of ipAttempts) {
        if (attempt.resetAt <= now) ipAttempts.delete(key);
      }
    }, WINDOW_MS);
    cleanup.unref();
  }

  return (req, res, next) => {
    const now = getNow();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    let current = ipAttempts.get(key);

    if (!current || current.resetAt <= now) {
      current = { count: 1, resetAt: now + WINDOW_MS, blockedEventLogged: false };
      ipAttempts.set(key, current);
    } else if (current.count >= LIMIT) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("RateLimit-Policy", `${LIMIT};w=${Math.floor(WINDOW_MS / 1000)}`);
      res.setHeader("RateLimit-Limit", String(LIMIT));
      res.setHeader("RateLimit-Remaining", "0");
      res.setHeader("RateLimit-Reset", String(Math.ceil(current.resetAt / 1000)));
      res.setHeader("Retry-After", String(retryAfter));
      if (!current.blockedEventLogged) {
        current.blockedEventLogged = true;
        options.onLimit?.();
      }
      return res.status(429).json({ error: "Trop de tentatives. Réessayez dans quelques minutes." });
    } else {
      current.count += 1;
    }

    res.setHeader("RateLimit-Policy", `${LIMIT};w=${Math.floor(WINDOW_MS / 1000)}`);
    res.setHeader("RateLimit-Limit", String(LIMIT));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, LIMIT - current.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(current.resetAt / 1000)));
    next();
  };
}

export const authLimiter = createIpRateLimiter({
  onLimit: () => {
    void logSecurityEvent(null, "auth_rate_limited").catch(error => {
      console.warn("[PulseBoard] Événement de limitation non journalisé:", (error as Error).message);
    });
  },
});
