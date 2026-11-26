ALTER TABLE "personal_patients" ADD COLUMN "age" integer;
ALTER TABLE "personal_patients" ADD CONSTRAINT "personal_patients_age_range" CHECK ("age" IS NULL OR ("age" >= 0 AND "age" <= 130));
