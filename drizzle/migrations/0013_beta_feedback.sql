CREATE TABLE "beta_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"category" text NOT NULL,
	"rating" integer NOT NULL,
	"message" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "beta_feedback_rating_range" CHECK ("rating" >= 1 AND "rating" <= 5)
);
