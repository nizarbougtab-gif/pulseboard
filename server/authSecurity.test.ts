import { describe, expect, it } from "vitest";
import { canUseSession } from "./_core/context";
import { safeAuthUser } from "./routers";

describe("authentication response safety", () => {
  it("never exposes password hashes or internal identity keys", () => {
    const result = safeAuthUser({
      id: 12,
      openId: "internal-user-key",
      passwordHash: "$2b$10$private-hash",
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
    expect(canUseSession({ emailVerified: false }, true)).toBe(false);
    expect(canUseSession({ emailVerified: true }, true)).toBe(true);
    expect(canUseSession({ emailVerified: false }, false)).toBe(true);
    expect(canUseSession(null, false)).toBe(false);
  });
});
