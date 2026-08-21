ALTER TABLE "observations" ALTER COLUMN "patientId" DROP NOT NULL;
ALTER TABLE "observations" ADD COLUMN IF NOT EXISTS "consultationId" integer;

CREATE INDEX IF NOT EXISTS "observations_patient_created" ON "observations" ("patientId", "createdAt");
CREATE INDEX IF NOT EXISTS "observations_consultation_created" ON "observations" ("consultationId", "createdAt");

ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "profession" text;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "address" text;

ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "patientDateOfBirth" text;
ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "patientGender" text;
ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "patientProfession" text;
ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "patientAddress" text;
ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "patientPhone" text;
ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "patientEmergencyContact" text;
