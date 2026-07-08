CREATE TABLE "join_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"serviceId" integer NOT NULL,
	"userId" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"resolvedAt" timestamp,
	"resolvedById" integer
);
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_code_unique" UNIQUE("code");