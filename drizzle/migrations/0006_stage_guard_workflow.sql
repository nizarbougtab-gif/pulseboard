ALTER TABLE "users" ADD COLUMN "medicalRoleVerified" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "medicalRoleVerifiedById" integer;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "medicalRoleVerifiedAt" timestamp;
--> statement-breakpoint
ALTER TABLE "care_decision_proposals" ADD COLUMN "urgency" text DEFAULT 'normal' NOT NULL;
--> statement-breakpoint
ALTER TABLE "care_decision_proposals" ADD COLUMN "assignedReviewerId" integer;
--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD COLUMN "supersedesNoteId" integer;
--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD COLUMN "correctionReason" text;
--> statement-breakpoint
ALTER TABLE "personal_patients" ADD COLUMN "encounterType" text DEFAULT 'hospitalisation' NOT NULL;
--> statement-breakpoint
ALTER TABLE "personal_patients" ADD COLUMN "anonymousCode" text;
--> statement-breakpoint
ALTER TABLE "personal_patients" ADD COLUMN "sourcePatientId" integer;
--> statement-breakpoint
CREATE TABLE "guards" (
	"id" serial PRIMARY KEY NOT NULL,
	"serviceId" integer NOT NULL,
	"startsAt" timestamp NOT NULL,
	"endsAt" timestamp NOT NULL,
	"supervisorId" integer,
	"guardStatus" text DEFAULT 'scheduled' NOT NULL,
	"summary" text,
	"createdById" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guard_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"guardId" integer NOT NULL,
	"userId" integer NOT NULL,
	"dutyRole" text DEFAULT 'student' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guard_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"guardId" integer NOT NULL,
	"patientId" integer NOT NULL,
	"assignedToId" integer NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procedures" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"rotationId" integer,
	"personalPatientId" integer,
	"title" text NOT NULL,
	"performedAt" timestamp DEFAULT now() NOT NULL,
	"participationLevel" text NOT NULL,
	"outcome" text,
	"attempts" integer DEFAULT 1,
	"reflection" text,
	"validated" boolean DEFAULT false,
	"validatedById" integer,
	"validatedAt" timestamp,
	"validatorComment" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
