import type { NextFunction, Request, Response } from "express";

const API_PATH_PREFIXES = ["/api/trpc", "/manus-storage"];

export function applySecurityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'self'; form-action 'self'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:; worker-src 'self' blob:; upgrade-insecure-requests"
    );
  }

  if (req.path.startsWith("/api/trpc")) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
  }

  next();
}

/** Reject browser requests to API routes that originate on another site. */
export function enforceSameOriginApi(req: Request, res: Response, next: NextFunction) {
  if (!API_PATH_PREFIXES.some(prefix => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
    next();
    return;
  }

  const origin = req.get("origin");
  if (!origin) {
    next();
    return;
  }

  const host = req.get("host");
  if (!host) {
    res.status(403).json({ error: "Origin non autorisée" });
    return;
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    res.status(403).json({ error: "Origin non autorisée" });
    return;
  }

  const expectedOrigin = `${req.protocol}://${host}`;
  if (parsedOrigin.origin !== expectedOrigin) {
    res.status(403).json({ error: "Origin non autorisée" });
    return;
  }

  next();
}
