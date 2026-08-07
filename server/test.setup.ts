import { vi } from "vitest";

vi.mock("./db", () => ({
  getHospitals: vi.fn(async () => []),
  getPatientById: vi.fn(async (id: number) => ({ id, serviceId: 1, firstName: "Test", lastName: "Patient" })),
  isServiceMember: vi.fn(async () => true),
  isServiceChef: vi.fn(async () => true),
  getNotesByPatient: vi.fn(async () => []),
  getVitalsByPatient: vi.fn(async () => []),
  getObservationsByPatient: vi.fn(async () => []),
  getPatientsByService: vi.fn(async () => []),
  createReleve: vi.fn(async () => 1),
  logActivity: vi.fn(async () => undefined),
}));
