import { describe, expect, it } from "vitest";
import {
  isPatientGivenNamePrefix,
  isPatientInitial,
  patientInitial,
  patientGivenNameAbbreviation,
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

  it("accepts only a single letter for a personal patient", () => {
    expect(isPatientInitial(" É ")).toBe(true);
    expect(isPatientInitial("Awa")).toBe(false);
    expect(isPatientInitial("A.")).toBe(false);
    expect(isPatientInitial(" ")).toBe(false);
  });

  it("uses only two letters of the given name", () => {
    expect(patientGivenNameAbbreviation("Awa")).toBe("Aw.");
    expect(patientGivenNameAbbreviation(" ÉMILE ")).toBe("Ém.");
    expect(isPatientGivenNamePrefix("Aw")).toBe(true);
    expect(isPatientGivenNamePrefix("Awa")).toBe(false);
    expect(isPatientGivenNamePrefix("A")).toBe(false);
  });
});
