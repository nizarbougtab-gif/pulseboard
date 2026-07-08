import { pgTable, serial, text, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const now = () => sql`now()`;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  passwordHash: text("passwordHash"),
  loginMethod: text("loginMethod"),
  role: text("role").$type<"user" | "admin">().default("user").notNull(),
  medicalRole: text("medicalRole").$type<"externe" | "interne" | "resident" | "medecin">().default("interne"),
  hospitalId: integer("hospitalId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const hospitals = pgTable("hospitals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull().default("Dakar"),
  address: text("address"),
  phone: text("phone"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  specialty: text("specialty").notNull(),
  hospitalId: integer("hospitalId").notNull(),
  createdById: integer("createdById").notNull(),
  totalBeds: integer("totalBeds").default(20),
  description: text("description"),
  code: text("code").unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const joinRequests = pgTable("join_requests", {
  id: serial("id").primaryKey(),
  serviceId: integer("serviceId").notNull(),
  userId: integer("userId").notNull(),
  status: text("status").$type<"pending" | "approved" | "rejected">().default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
  resolvedById: integer("resolvedById"),
});

export const serviceMembers = pgTable("service_members", {
  id: serial("id").primaryKey(),
  serviceId: integer("serviceId").notNull(),
  userId: integer("userId").notNull(),
  role: text("memberRole").$type<"chef" | "senior" | "junior" | "stagiaire">().default("junior"),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  firstName: text("firstName").notNull(),
  lastName: text("lastName").notNull(),
  dateOfBirth: text("dateOfBirth"),
  gender: text("gender").$type<"M" | "F">().default("M"),
  phone: text("phone"),
  emergencyContact: text("emergencyContact"),
  serviceId: integer("serviceId").notNull(),
  bedNumber: integer("bedNumber"),
  status: text("status").$type<"stable" | "modere" | "critique">().default("stable").notNull(),
  admissionDate: timestamp("admissionDate").defaultNow().notNull(),
  expectedDischarge: text("expectedDischarge"),
  actualDischarge: text("actualDischarge"),
  diagnosis: text("diagnosis"),
  allergies: text("allergies"),
  antecedents: text("antecedents"),
  notes: text("notes"),
  dpsCompleted: boolean("dpsCompleted").default(false),
  createdById: integer("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const patientTasks = pgTable("patient_tasks", {
  id: serial("id").primaryKey(),
  patientId: integer("patientId").notNull(),
  serviceId: integer("serviceId").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").$type<"low" | "medium" | "high" | "urgent">().default("medium"),
  status: text("taskStatus").$type<"pending" | "in_progress" | "completed" | "overdue">().default("pending"),
  dueDate: text("dueDate"),
  assignedToId: integer("assignedToId"),
  completedAt: text("completedAt"),
  createdById: integer("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  serviceId: integer("serviceId").notNull(),
  patientId: integer("patientId"),
  type: text("alertType").$type<"dps_missing" | "no_bed" | "task_overdue" | "critical_patient">().notNull(),
  message: text("message").notNull(),
  resolved: boolean("resolved").default(false),
  resolvedAt: text("resolvedAt"),
  resolvedById: integer("resolvedById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const serviceMessages = pgTable("service_messages", {
  id: serial("id").primaryKey(),
  serviceId: integer("serviceId").notNull(),
  userId: integer("userId").notNull(),
  channel: text("channel").$type<"alertes" | "releve" | "equipe">().default("equipe"),
  patientId: integer("patientId"),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  serviceId: integer("serviceId").notNull(),
  patientId: integer("patientId"),
  userId: integer("userId").notNull(),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const releves = pgTable("releves", {
  id: serial("id").primaryKey(),
  serviceId: integer("serviceId").notNull(),
  generatedById: integer("generatedById").notNull(),
  content: text("content").notNull(),
  pdfUrl: text("pdfUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const consultations = pgTable("consultations", {
  id: serial("id").primaryKey(),
  serviceId: integer("serviceId").notNull(),
  patientFirstName: text("patientFirstName").notNull(),
  patientLastName: text("patientLastName").notNull(),
  motif: text("motif").notNull(),
  status: text("consultStatus").$type<"en_attente" | "vu" | "reporte">().default("en_attente").notNull(),
  notes: text("notes"),
  createdById: integer("createdById").notNull(),
  consultDate: timestamp("consultDate").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const clinicalNotes = pgTable("clinical_notes", {
  id: serial("id").primaryKey(),
  patientId: integer("patientId").notNull(),
  serviceId: integer("serviceId").notNull(),
  type: text("noteType").$type<"dar" | "soap" | "libre">().default("dar").notNull(),
  content: text("content").notNull(),
  createdById: integer("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const vitalSigns = pgTable("vital_signs", {
  id: serial("id").primaryKey(),
  patientId: integer("patientId").notNull(),
  serviceId: integer("serviceId").notNull(),
  temperature: text("temperature"),
  bloodPressure: text("bloodPressure"),
  heartRate: text("heartRate"),
  respiratoryRate: text("respiratoryRate"),
  oxygenSaturation: text("oxygenSaturation"),
  gcs: text("gcs"),
  pain: text("pain"),
  notes: text("notes"),
  recordedById: integer("recordedById").notNull(),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export const observations = pgTable("observations", {
  id: serial("id").primaryKey(),
  patientId: integer("patientId").notNull(),
  serviceId: integer("serviceId").notNull(),
  content: text("content").notNull(),
  category: text("obsCategory").$type<"clinique" | "infirmier" | "evolution" | "autre">().default("clinique"),
  createdById: integer("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const rotations = pgTable("rotations", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  serviceId: integer("serviceId").notNull(),
  serviceName: text("serviceName").notNull(),
  hospitalName: text("hospitalName").notNull(),
  supervisorName: text("supervisorName"),
  startDate: text("startDate").notNull(),
  endDate: text("endDate"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const personalPatients = pgTable("personal_patients", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  firstName: text("firstName").notNull(),
  lastName: text("lastName").notNull(),
  dateOfBirth: text("dateOfBirth"),
  gender: text("gender").$type<"M" | "F">().default("M"),
  phone: text("phone"),
  status: text("status").$type<"stable" | "modere" | "critique">().default("stable").notNull(),
  admissionDate: timestamp("admissionDate").defaultNow().notNull(),
  diagnosis: text("diagnosis"),
  allergies: text("allergies"),
  antecedents: text("antecedents"),
  serviceName: text("serviceName"),
  bedNumber: integer("bedNumber"),
  discharged: boolean("discharged").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const personalNotes = pgTable("personal_notes", {
  id: serial("id").primaryKey(),
  personalPatientId: integer("personalPatientId").notNull(),
  userId: integer("userId").notNull(),
  type: text("noteType").$type<"dar" | "soap" | "libre">().default("dar").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const personalTasks = pgTable("personal_tasks", {
  id: serial("id").primaryKey(),
  personalPatientId: integer("personalPatientId").notNull(),
  userId: integer("userId").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").$type<"low" | "medium" | "high" | "urgent">().default("medium"),
  status: text("taskStatus").$type<"pending" | "completed">().default("pending"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const personalVitals = pgTable("personal_vitals", {
  id: serial("id").primaryKey(),
  personalPatientId: integer("personalPatientId").notNull(),
  userId: integer("userId").notNull(),
  temperature: text("temperature"),
  bloodPressure: text("bloodPressure"),
  heartRate: text("heartRate"),
  respiratoryRate: text("respiratoryRate"),
  oxygenSaturation: text("oxygenSaturation"),
  gcs: text("gcs"),
  pain: text("pain"),
  notes: text("notes"),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export const personalObservations = pgTable("personal_observations", {
  id: serial("id").primaryKey(),
  personalPatientId: integer("personalPatientId").notNull(),
  userId: integer("userId").notNull(),
  content: text("content").notNull(),
  category: text("obsCategory").$type<"clinique" | "infirmier" | "evolution" | "autre">().default("clinique"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const competences = pgTable("competences", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  rotationId: integer("rotationId"),
  title: text("title").notNull(),
  category: text("compCategory").$type<"geste_technique" | "diagnostic" | "therapeutique" | "communication" | "autre">().default("geste_technique"),
  validated: boolean("validated").default(false),
  validatedById: integer("validatedById"),
  validatedAt: text("validatedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
