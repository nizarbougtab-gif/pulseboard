ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerified" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "privacyAcceptedAt" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletionRequestedAt" timestamp;

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL,
  "plan" text DEFAULT 'free' NOT NULL,
  "subscriptionStatus" text DEFAULT 'inactive' NOT NULL,
  "billingCycle" text DEFAULT 'monthly' NOT NULL,
  "provider" text DEFAULT 'manual' NOT NULL,
  "providerCustomerId" text,
  "providerSubscriptionId" text,
  "currentPeriodEnd" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "subscriptions_userId_unique" UNIQUE("userId")
);

CREATE TABLE IF NOT EXISTS "payments" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL,
  "reference" text NOT NULL,
  "plan" text NOT NULL,
  "billingCycle" text DEFAULT 'monthly' NOT NULL,
  "amountFcfa" integer NOT NULL,
  "provider" text DEFAULT 'wave' NOT NULL,
  "paymentStatus" text DEFAULT 'pending' NOT NULL,
  "providerTransactionId" text,
  "paidAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "payments_reference_unique" UNIQUE("reference")
);

CREATE TABLE IF NOT EXISTS "account_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL,
  "tokenKind" text NOT NULL,
  "tokenHash" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "usedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "account_tokens_tokenHash_unique" UNIQUE("tokenHash")
);

CREATE TABLE IF NOT EXISTS "security_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer,
  "eventType" text NOT NULL,
  "details" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "account_tokens_lookup" ON "account_tokens" ("tokenHash", "tokenKind");
CREATE INDEX IF NOT EXISTS "payments_user" ON "payments" ("userId", "createdAt");
