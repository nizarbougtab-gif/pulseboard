import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

const ctx = {
  user: {
    id: 7,
    openId: "user-7",
    email: "user7@example.com",
    name: "Dr Test",
    loginMethod: "email",
    role: "user" as const,
    medicalRole: "interne" as const,
    hospitalId: null,
    passwordHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} },
  res: {},
} as TrpcContext;

describe("service authorization", () => {
  beforeEach(() => {
    vi.mocked(db.isServiceMember).mockResolvedValue(false);
  });

  it("refuses a service that does not belong to the user", async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(caller.services.get({ id: 99 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses a patient from another service", async () => {
    vi.mocked(db.getPatientById).mockResolvedValue({ id: 4, serviceId: 99 } as never);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.patients.get({ id: 4 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
