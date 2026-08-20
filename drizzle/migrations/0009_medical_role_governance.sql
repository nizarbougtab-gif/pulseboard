CREATE TABLE IF NOT EXISTS "medical_role_change_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL,
  "currentRole" text NOT NULL,
  "requestedRole" text NOT NULL,
  "reason" text NOT NULL,
  "requestStatus" text DEFAULT 'pending' NOT NULL,
  "resolvedById" integer,
  "resolutionNote" text,
  "resolvedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "medical_role_reviews" (
  "id" serial PRIMARY KEY NOT NULL,
  "targetUserId" integer NOT NULL,
  "reviewerId" integer NOT NULL,
  "serviceId" integer NOT NULL,
  "requestId" integer,
  "reviewKind" text NOT NULL,
  "reviewDecision" text NOT NULL,
  "reviewerMedicalRole" text NOT NULL,
  "note" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "medical_role_change_user_status" ON "medical_role_change_requests" ("userId", "requestStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "medical_role_reviews_target" ON "medical_role_reviews" ("targetUserId", "reviewKind", "serviceId", "requestId");
CREATE UNIQUE INDEX IF NOT EXISTS "medical_role_reviews_unique_reviewer" ON "medical_role_reviews" ("targetUserId", "reviewerId", "serviceId", "reviewKind", COALESCE("requestId", 0));
