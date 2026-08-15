import { describe, expect, it } from "vitest";
import {
  patientInitial,
  patientInitials,
  patientInitialsCompact,
  sanitizePatientInitial,
} from "../shared/patientIdentity";

describe("patient identity privacy", () => {
  it("formats only initials for collective displays", () => {
    expect(patientInitials("Awa", "Ndiaye")).toBe("A. N.");
    expect(patientInitialsCompact("Awa", "Ndiaye")).toBe("AN");
  });

  it("normalizes entered initials", () => {
    expect(patientInitial(" émilie ")).toBe("É");
    expect(sanitizePatientInitial("n.diaye")).toBe("N");
  });
});
