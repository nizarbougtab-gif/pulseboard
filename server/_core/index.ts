import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { seedHospitalsIfEmpty, runMigrations } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL est requis en production");
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error("JWT_SECRET doit contenir au moins 32 caractères en production");
    }
  }

  // Migrations automatiques au démarrage
  await runMigrations();
  // Seed hôpitaux sénégalais si la table est vide
  await seedHospitalsIfEmpty();

  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:; worker-src 'self' blob:"
      );
    }
    next();
  });

  const loginAttempts = new Map<string, { count: number; resetAt: number }>();
  app.use("/api/trpc/auth.login", (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const current = loginAttempts.get(key);
    if (!current || current.resetAt <= now) {
      loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
      return next();
    }
    if (current.count >= 10) {
      res.setHeader("Retry-After", String(Math.ceil((current.resetAt - now) / 1000)));
      return res.status(429).json({ error: "Trop de tentatives. Réessayez dans quelques minutes." });
    }
    current.count += 1;
    next();
  });

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
