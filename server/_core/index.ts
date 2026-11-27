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
import { seedHospitalsIfEmpty, runMigrations, ensureConfiguredAdmins, cleanupStaleLoginAttempts } from "../db";
import { ENV } from "./env";
import { authLimiter } from "./rateLimit";
import { applySecurityHeaders, enforceSameOriginApi } from "./security";

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
    if (ENV.emailVerificationEnforced) {
      if (!ENV.resendApiKey) throw new Error("RESEND_API_KEY est requis lorsque EMAIL_VERIFICATION_ENFORCED=true");
      if (!ENV.publicAppUrl) throw new Error("PUBLIC_APP_URL est requis lorsque EMAIL_VERIFICATION_ENFORCED=true");
      if (!process.env.EMAIL_FROM) throw new Error("EMAIL_FROM est requis lorsque EMAIL_VERIFICATION_ENFORCED=true");
    }
  }

  // Migrations automatiques au démarrage
  if (process.env.NODE_ENV === "production" && process.env.BILLING_ENFORCED === "true") {
    if (!process.env.WAVE_PAYMENT_LINK) throw new Error("WAVE_PAYMENT_LINK est requis lorsque BILLING_ENFORCED=true");
    if (ENV.adminEmails.length === 0) throw new Error("PULSEBOARD_ADMIN_EMAILS est requis lorsque BILLING_ENFORCED=true");
  }
  await runMigrations();
  void cleanupStaleLoginAttempts().catch(error => console.warn("[PulseBoard] Nettoyage des tentatives de connexion impossible:", (error as Error).message));
  const loginAttemptCleanup = setInterval(() => {
    void cleanupStaleLoginAttempts().catch(error => console.warn("[PulseBoard] Nettoyage des tentatives de connexion impossible:", (error as Error).message));
  }, 24 * 60 * 60_000);
  loginAttemptCleanup.unref();
  // Seed hôpitaux sénégalais si la table est vide
  await seedHospitalsIfEmpty();
  await ensureConfiguredAdmins(ENV.adminEmails);

  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
  app.use(applySecurityHeaders);
  app.use(enforceSameOriginApi);

  app.use(["/api/trpc/auth.login", "/api/trpc/auth.register", "/api/trpc/auth.forgotPassword", "/api/trpc/auth.resetPassword", "/api/trpc/auth.resendVerification"], authLimiter);

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true, parameterLimit: 100 }));
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
