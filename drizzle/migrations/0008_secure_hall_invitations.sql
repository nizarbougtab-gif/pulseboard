ALTER TABLE "service_members"
  ADD COLUMN IF NOT EXISTS "provisional" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "service_invitations" (
  "id" serial PRIMARY KEY NOT NULL,
  "serviceId" integer NOT NULL,
  "tokenHash" text NOT NULL,
  "createdById" integer NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "maxUses" integer DEFAULT 20 NOT NULL,
  "usedCount" integer DEFAULT 0 NOT NULL,
  "revokedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "service_invitations_tokenHash_unique" UNIQUE("tokenHash")
);

CREATE INDEX IF NOT EXISTS "service_invitations_service" ON "service_invitations" ("serviceId", "expiresAt");
