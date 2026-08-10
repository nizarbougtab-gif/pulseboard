CREATE TABLE "care_decision_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"serviceId" integer NOT NULL,
	"subjectType" text NOT NULL,
	"subjectId" integer NOT NULL,
	"decisionType" text NOT NULL,
	"destination" text,
	"reason" text,
	"bedNumber" integer,
	"patientStatus" text,
	"proposalStatus" text DEFAULT 'pending' NOT NULL,
	"proposedById" integer NOT NULL,
	"reviewedById" integer,
	"reviewNote" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"reviewedAt" timestamp
);
--> statement-breakpoint
CREATE INDEX "care_decision_service_status_idx" ON "care_decision_proposals" USING btree ("serviceId", "proposalStatus");
--> statement-breakpoint
UPDATE "personal_patients"
SET
	"firstName" = UPPER(LEFT(TRIM("firstName"), 1)) || '.',
	"lastName" = UPPER(LEFT(TRIM("lastName"), 1)) || '.',
	"dateOfBirth" = NULL,
	"phone" = NULL;
