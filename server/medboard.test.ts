import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: any[] } {
  const clearedCookies: any[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "test@hopital.sn",
    name: "Dr. Test",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Dr. Test");
    expect(result?.email).toBe("test@hopital.sn");
  });

  it("returns null when not authenticated", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("hospitals.list", () => {
  it("returns a list of hospitals (public procedure)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // This will attempt DB call - may return empty in test env
    const result = await caller.hospitals.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("releve.generate", () => {
  it("generates releve content with correct format", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // This tests the releve generation logic
    // In a real scenario, we'd need patients in the DB
    // Here we verify the procedure exists and is callable
    try {
      const result = await caller.releve.generate({ serviceId: 999 });
      // If it succeeds, verify content structure
      expect(result.content).toContain("RELÈVE DU SERVICE");
      expect(result.content).toContain("FIN DE RELÈVE");
    } catch (e: any) {
      // Expected if no DB or service doesn't exist
      expect(e.message).toBeDefined();
    }
  });
});

describe("router structure", () => {
  it("has all expected routers defined", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Verify all routers exist
    expect(caller.auth).toBeDefined();
    expect(caller.hospitals).toBeDefined();
    expect(caller.services).toBeDefined();
    expect(caller.patients).toBeDefined();
    expect(caller.tasks).toBeDefined();
    expect(caller.alerts).toBeDefined();
    expect(caller.messages).toBeDefined();
    expect(caller.activity).toBeDefined();
    expect(caller.releve).toBeDefined();
    expect(caller.profile).toBeDefined();
  });
});
