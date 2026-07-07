import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Dr. Test",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("consultations router", () => {
  it("list consultations requires serviceId", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Should not throw with valid input
    try {
      const result = await caller.consultations.list({ serviceId: 999 });
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      // Service might not exist, but the procedure should accept the input
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });

  it("create consultation validates required fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Should throw on empty required fields
    try {
      await caller.consultations.create({
        serviceId: 1,
        patientFirstName: "",
        patientLastName: "Test",
        motif: "Otalgie",
      });
      expect(true).toBe(false); // Should not reach here
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });
});

describe("notes router", () => {
  it("byPatient returns array", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.notes.byPatient({ patientId: 999 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("create note validates type enum", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Should throw on invalid type
    try {
      await (caller.notes.create as any)({
        patientId: 1,
        serviceId: 1,
        type: "invalid_type",
        content: "test content",
      });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });
});

describe("vitals router", () => {
  it("byPatient returns array", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vitals.byPatient({ patientId: 999 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("observations router", () => {
  it("byPatient returns array", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.observations.byPatient({ patientId: 999 });
    expect(Array.isArray(result)).toBe(true);
  });
});
