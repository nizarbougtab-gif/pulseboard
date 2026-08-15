import { describe, expect, it } from "vitest";
import { canAutoJoinService, canDo } from "../shared/permissions";

describe("clinical permissions", () => {
  it("allows an extern to document and propose without applying a discharge", () => {
    expect(canDo("externe", "note.create")).toBe(true);
    expect(canDo("externe", "patient.proposeDecision")).toBe(true);
    expect(canDo("externe", "patient.discharge")).toBe(false);
    expect(canDo("externe", "decision.review")).toBe(false);
    expect(canDo("externe", "guard.manage")).toBe(false);
    expect(canDo("externe", "service.create")).toBe(false);
  });

  it("allows residents and physicians to review critical decisions", () => {
    expect(canDo("resident", "decision.review")).toBe(true);
    expect(canDo("medecin", "decision.review")).toBe(true);
    expect(canDo("resident", "patient.discharge")).toBe(true);
    expect(canDo("resident", "guard.manage")).toBe(true);
  });

  it("allows interns and residents to create their own service", () => {
    expect(canDo("interne", "service.create")).toBe(true);
    expect(canDo("interne", "guard.manage")).toBe(true);
    expect(canDo("interne", "patient.discharge")).toBe(false);
    expect(canDo("resident", "service.create")).toBe(true);
    expect(canDo("externe", "service.create")).toBe(false);
  });

  it("does not define an hospital administrator role", () => {
    expect(canDo("admin_hopital" as never, "service.manage")).toBe(false);
  });

  it("auto-joins only verified clinicians from the same hospital", () => {
    expect(canAutoJoinService("interne", true, 1, 1)).toBe(true);
    expect(canAutoJoinService("resident", true, 1, 1)).toBe(true);
    expect(canAutoJoinService("medecin", true, 1, 1)).toBe(true);
    expect(canAutoJoinService("externe", true, 1, 1)).toBe(false);
    expect(canAutoJoinService("resident", false, 1, 1)).toBe(false);
    expect(canAutoJoinService("resident", true, 2, 1)).toBe(false);
  });
});
