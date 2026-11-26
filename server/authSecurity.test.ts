import { describe, expect, it } from "vitest";
import { canUseSession } from "./_core/context";
import { safeAuthUser } from "./routers";

describe("authentication response safety", () => {
  it("never exposes password hashes or internal identity keys", () => {
    const result = safeAuthUser({
      id: 12,
      openId: "internal-user-key",
      passwordHash: "$2b$10$private-hash",
      sessionVersion: 4,
      email: "clinician@example.test",
      name: "Clinician",
      medicalRole: "interne",
    });

    expect(result).toEqual({
      id: 12,
      email: "clinician@example.test",
      name: "Clinician",
      medicalRole: "interne",
    });
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("openId");
  });

  it("rejects old unverified sessions when email verification is enforced", () => {
    expect(canUseSession({ emailVerified: false, sessionVersion: 0 }, true)).toBe(false);
    expect(canUseSession({ emailVerified: true, sessionVersion: 0 }, true)).toBe(true);
    expect(canUseSession({ emailVerified: false, sessionVersion: 0 }, false)).toBe(true);
    expect(canUseSession({ emailVerified: true, sessionVersion: 1 }, false, 0)).toBe(false);
    expect(canUseSession({ emailVerified: true, sessionVersion: 1 }, false, 1)).toBe(true);
    expect(canUseSession(null, false)).toBe(false);
  });
});
