CREATE TABLE "personal_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"personalPatientId" integer NOT NULL,
	"userId" integer NOT NULL,
	"noteType" text DEFAULT 'dar' NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"personalPatientId" integer NOT NULL,
	"userId" integer NOT NULL,
	"content" text NOT NULL,
	"obsCategory" text DEFAULT 'clinique',
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_patients" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"dateOfBirth" text,
	"gender" text DEFAULT 'M',
	"phone" text,
	"status" text DEFAULT 'stable' NOT NULL,
	"admissionDate" timestamp DEFAULT now() NOT NULL,
	"diagnosis" text,
	"allergies" text,
	"antecedents" text,
	"serviceName" text,
	"bedNumber" integer,
	"discharged" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"personalPatientId" integer NOT NULL,
	"userId" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'medium',
	"taskStatus" text DEFAULT 'pending',
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_vitals" (
	"id" serial PRIMARY KEY NOT NULL,
	"personalPatientId" integer NOT NULL,
	"userId" integer NOT NULL,
	"temperature" text,
	"bloodPressure" text,
	"heartRate" text,
	"respiratoryRate" text,
	"oxygenSaturation" text,
	"gcs" text,
	"pain" text,
	"notes" text,
	"recordedAt" timestamp DEFAULT now() NOT NULL
);
