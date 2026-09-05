CREATE TABLE IF NOT EXISTS "hall_waitlist" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "medicalRole" text NOT NULL,
  "hospitalName" text NOT NULL,
  "serviceName" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "hall_waitlist_email_unique" UNIQUE("email")
);
