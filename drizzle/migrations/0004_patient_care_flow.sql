ALTER TABLE "patients" ADD COLUMN "dischargeDisposition" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "referralDestination" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "referralReason" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "referralDate" timestamp;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "disposition" text;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "linkedPatientId" integer;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "referralDestination" text;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "referralReason" text;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "closedAt" timestamp;
