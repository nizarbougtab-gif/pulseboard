import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

const ctx = {
  user: { id: 7, openId: "beta-user", name: "Testeur", email: "test@example.com" },
  req: {} as any,
  res: {} as any,
};

describe("beta safety", () => {
  it("refuses a personal case without fictitious-data confirmation", async () => {
    const caller = appRouter.createCaller(ctx as any);
    await expect(caller.personalPatients.create({
      firstName: "Ma",
      lastName: "D",
      age: 54,
      gender: "M",
      status: "stable",
      encounterType: "consultation",
      fictitiousDataConfirmed: false,
    })).rejects.toThrow("entièrement fictifs");
  });

  it("refuses beta feedback without the no-patient-data confirmation", async () => {
    const caller = appRouter.createCaller(ctx as any);
    await expect(caller.beta.submitFeedback({
      category: "idee",
      rating: 5,
      message: "Une suggestion suffisamment détaillée.",
      containsNoPatientData: false as true,
    })).rejects.toThrow();
  });
});
