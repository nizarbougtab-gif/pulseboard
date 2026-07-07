CREATE TABLE "activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"serviceId" integer NOT NULL,
	"patientId" integer,
	"userId" integer NOT NULL,
	"action" text NOT NULL,
	"details" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"serviceId" integer NOT NULL,
	"patientId" integer,
	"alertType" text NOT NULL,
	"message" text NOT NULL,
	"resolved" boolean DEFAULT false,
	"resolvedAt" text,
	"resolvedById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"patientId" integer NOT NULL,
	"serviceId" integer NOT NULL,
	"noteType" text DEFAULT 'dar' NOT NULL,
	"content" text NOT NULL,
	"createdById" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competences" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"rotationId" integer,
	"title" text NOT NULL,
	"compCategory" text DEFAULT 'geste_technique',
	"validated" boolean DEFAULT false,
	"validatedById" integer,
	"validatedAt" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultations" (
	"id" serial PRIMARY KEY NOT NULL,
	"serviceId" integer NOT NULL,
	"patientFirstName" text NOT NULL,
	"patientLastName" text NOT NULL,
	"motif" text NOT NULL,
	"consultStatus" text DEFAULT 'en_attente' NOT NULL,
	"notes" text,
	"createdById" integer NOT NULL,
	"consultDate" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hospitals" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text DEFAULT 'Dakar' NOT NULL,
	"address" text,
	"phone" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"patientId" integer NOT NULL,
	"serviceId" integer NOT NULL,
	"content" text NOT NULL,
	"obsCategory" text DEFAULT 'clinique',
	"createdById" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"patientId" integer NOT NULL,
	"serviceId" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'medium',
	"taskStatus" text DEFAULT 'pending',
	"dueDate" text,
	"assignedToId" integer,
	"completedAt" text,
	"createdById" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" serial PRIMARY KEY NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"dateOfBirth" text,
	"gender" text DEFAULT 'M',
	"phone" text,
	"emergencyContact" text,
	"serviceId" integer NOT NULL,
	"bedNumber" integer,
	"status" text DEFAULT 'stable' NOT NULL,
	"admissionDate" timestamp DEFAULT now() NOT NULL,
	"expectedDischarge" text,
	"actualDischarge" text,
	"diagnosis" text,
	"allergies" text,
	"antecedents" text,
	"notes" text,
	"dpsCompleted" boolean DEFAULT false,
	"createdById" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "releves" (
	"id" serial PRIMARY KEY NOT NULL,
	"serviceId" integer NOT NULL,
	"generatedById" integer NOT NULL,
	"content" text NOT NULL,
	"pdfUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"serviceId" integer NOT NULL,
	"serviceName" text NOT NULL,
	"hospitalName" text NOT NULL,
	"supervisorName" text,
	"startDate" text NOT NULL,
	"endDate" text,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"serviceId" integer NOT NULL,
	"userId" integer NOT NULL,
	"memberRole" text DEFAULT 'junior',
	"joinedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"serviceId" integer NOT NULL,
	"userId" integer NOT NULL,
	"channel" text DEFAULT 'equipe',
	"patientId" integer,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"specialty" text NOT NULL,
	"hospitalId" integer NOT NULL,
	"createdById" integer NOT NULL,
	"totalBeds" integer DEFAULT 20,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" text NOT NULL,
	"name" text,
	"email" text,
	"passwordHash" text,
	"loginMethod" text,
	"role" text DEFAULT 'user' NOT NULL,
	"medicalRole" text DEFAULT 'interne',
	"hospitalId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "vital_signs" (
	"id" serial PRIMARY KEY NOT NULL,
	"patientId" integer NOT NULL,
	"serviceId" integer NOT NULL,
	"temperature" text,
	"bloodPressure" text,
	"heartRate" text,
	"respiratoryRate" text,
	"oxygenSaturation" text,
	"gcs" text,
	"pain" text,
	"notes" text,
	"recordedById" integer NOT NULL,
	"recordedAt" timestamp DEFAULT now() NOT NULL
);
