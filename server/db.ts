import { eq, asc, desc, count, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "path";
import { InsertUser, users, hospitals, services, serviceMembers, patients, patientTasks, alerts, serviceMessages, activityLog, releves, consultations, clinicalNotes, vitalSigns, observations, rotations, competences } from "../drizzle/schema";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/pulseboard";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    const client = postgres(DATABASE_URL);
    _db = drizzle(client);
  }
  return _db;
}

export async function runMigrations() {
  try {
    const migrationsFolder = path.join(process.cwd(), "drizzle", "migrations");
    const migrationClient = postgres(DATABASE_URL, { max: 1 });
    const db = drizzle(migrationClient);
    await migrate(db, { migrationsFolder });
    await migrationClient.end();
    console.log("[PulseBoard] Migrations PostgreSQL appliquées ✓");
  } catch (err) {
    console.warn("[PulseBoard] Migrations non disponibles:", (err as Error).message);
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.openId, user.openId));
  if (existing) {
    await db.update(users).set({ ...user, updatedAt: new Date(), lastSignedIn: new Date() }).where(eq(users.openId, user.openId));
  } else {
    await db.insert(users).values({ ...user, lastSignedIn: new Date() });
  }
}

export async function getUserByOpenId(openId: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.openId, openId));
  return user ?? null;
}

export async function getUserByEmail(email: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user ?? null;
}

export async function getUserById(id: number) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user ?? null;
}

// ===== HOSPITALS =====
export async function getHospitals() {
  const db = getDb();
  return db.select().from(hospitals).orderBy(asc(hospitals.name));
}

const SENEGAL_HOSPITALS = [
  { name: "CHU Aristide Le Dantec", city: "Dakar", address: "Avenue Pasteur, Dakar", phone: "+221 33 822 24 20" },
  { name: "CHU de Fann", city: "Dakar", address: "Avenue Cheikh Anta Diop, Dakar", phone: "+221 33 869 18 18" },
  { name: "Hôpital Principal de Dakar", city: "Dakar", address: "Avenue Nelson Mandela, Dakar", phone: "+221 33 839 50 50" },
  { name: "Hôpital Abass Ndao", city: "Dakar", address: "Boulevard du Centenaire, Dakar", phone: "+221 33 849 78 00" },
  { name: "CHR de Thiès", city: "Thiès", address: "Avenue Léopold Sédar Senghor, Thiès", phone: "+221 33 951 11 93" },
  { name: "Hôpital de Ziguinchor", city: "Ziguinchor", address: "Quartier Santhiaba, Ziguinchor", phone: "+221 33 991 21 15" },
  { name: "Hôpital de Tambacounda", city: "Tambacounda", address: "Route de Kolda, Tambacounda", phone: "+221 33 981 10 01" },
  { name: "Centre de Santé de Pikine", city: "Pikine", address: "Pikine, Dakar", phone: "+221 33 834 23 45" },
  { name: "Hôpital Régional de Saint-Louis", city: "Saint-Louis", address: "Rue Samba Diéry Diallo, Saint-Louis", phone: "+221 33 961 15 25" },
  { name: "CHR de Kaolack", city: "Kaolack", address: "Route de Dakar, Kaolack", phone: "+221 33 941 29 53" },
  { name: "Hôpital de Diourbel", city: "Diourbel", address: "Quartier Médina, Diourbel", phone: "+221 33 971 17 42" },
  { name: "Hôpital Youssou Mbargane", city: "Rufisque", address: "Rufisque, Dakar", phone: "+221 33 836 17 60" },
];

export async function seedHospitalsIfEmpty(): Promise<void> {
  try {
    const db = getDb();
    const existing = await db.select().from(hospitals).limit(1);
    if (existing.length === 0) {
      for (const h of SENEGAL_HOSPITALS) {
        await db.insert(hospitals).values(h);
      }
      console.log("[PulseBoard] Hôpitaux sénégalais initialisés ✓");
    }
  } catch (err) {
    console.warn("[PulseBoard] Impossible d'initialiser les hôpitaux:", err);
  }
}

// ===== SERVICES =====
export async function getServicesByUser(userId: number) {
  const db = getDb();
  const memberships = await db.select().from(serviceMembers).where(eq(serviceMembers.userId, userId));
  if (memberships.length === 0) return [];
  const result = [];
  for (const m of memberships) {
    const [s] = await db.select().from(services).where(eq(services.id, m.serviceId));
    if (s) result.push(s);
  }
  return result;
}

export async function getServiceById(serviceId: number) {
  const db = getDb();
  const [service] = await db.select().from(services).where(eq(services.id, serviceId));
  return service ?? null;
}

export async function createService(data: { name: string; specialty: string; hospitalId: number; createdById: number; totalBeds?: number; description?: string }) {
  const db = getDb();
  const [{ id }] = await db.insert(services).values(data).returning({ id: services.id });
  await db.insert(serviceMembers).values({ serviceId: id, userId: data.createdById, role: "chef" });
  return id;
}

// ===== PATIENTS =====
export async function getPatientsByService(serviceId: number, filter?: string) {
  const db = getDb();
  let all = await db.select().from(patients).where(eq(patients.serviceId, serviceId));
  if (filter === "urgents") all = all.filter(p => p.status === "critique");
  else if (filter === "sortie_prevue") all = all.filter(p => p.expectedDischarge != null && p.actualDischarge == null);
  else if (filter === "sortis") all = all.filter(p => p.actualDischarge != null);
  else all = all.filter(p => p.actualDischarge == null);
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getPatientById(patientId: number) {
  const db = getDb();
  const [patient] = await db.select().from(patients).where(eq(patients.id, patientId));
  return patient ?? null;
}

export async function createPatient(data: {
  firstName: string; lastName: string; serviceId: number; createdById: number;
  bedNumber?: number; status?: "stable" | "modere" | "critique";
  diagnosis?: string; allergies?: string; antecedents?: string; notes?: string;
  dateOfBirth?: string; gender?: "M" | "F"; phone?: string; emergencyContact?: string;
  expectedDischarge?: string;
}) {
  const db = getDb();
  const [{ id }] = await db.insert(patients).values(data).returning({ id: patients.id });
  return id;
}

export async function updatePatient(patientId: number, data: Partial<{
  firstName: string; lastName: string; bedNumber: number | null; status: "stable" | "modere" | "critique";
  diagnosis: string; allergies: string; antecedents: string; notes: string;
  expectedDischarge: string | null; actualDischarge: string | null; dpsCompleted: boolean;
}>) {
  const db = getDb();
  await db.update(patients).set({ ...data, updatedAt: new Date() }).where(eq(patients.id, patientId));
}

// ===== TASKS =====
export async function getTasksByPatient(patientId: number) {
  const db = getDb();
  const all = await db.select().from(patientTasks).where(eq(patientTasks.patientId, patientId));
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getTasksByService(serviceId: number) {
  const db = getDb();
  return db.select().from(patientTasks).where(eq(patientTasks.serviceId, serviceId));
}

export async function createTask(data: { patientId: number; serviceId: number; title: string; description?: string; priority?: "low" | "medium" | "high" | "urgent"; dueDate?: string; assignedToId?: number; createdById: number }) {
  const db = getDb();
  const [{ id }] = await db.insert(patientTasks).values(data).returning({ id: patientTasks.id });
  return id;
}

export async function updateTask(taskId: number, data: Partial<{ status: "pending" | "in_progress" | "completed" | "overdue"; completedAt: string | null }>) {
  const db = getDb();
  await db.update(patientTasks).set(data).where(eq(patientTasks.id, taskId));
}

// ===== ALERTS =====
export async function getAlertsByService(serviceId: number, onlyActive?: boolean) {
  const db = getDb();
  let all = await db.select().from(alerts).where(eq(alerts.serviceId, serviceId));
  if (onlyActive) all = all.filter(a => !a.resolved);
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createAlert(data: { serviceId: number; patientId?: number; type: "dps_missing" | "no_bed" | "task_overdue" | "critical_patient"; message: string }) {
  const db = getDb();
  const [{ id }] = await db.insert(alerts).values(data).returning({ id: alerts.id });
  return id;
}

export async function resolveAlert(alertId: number, userId: number) {
  const db = getDb();
  await db.update(alerts).set({ resolved: true, resolvedAt: new Date().toISOString(), resolvedById: userId }).where(eq(alerts.id, alertId));
}

// ===== MESSAGES =====
export async function getMessagesByService(serviceId: number, limit = 50) {
  const db = getDb();
  const msgs = await db.select({
    id: serviceMessages.id,
    content: serviceMessages.content,
    channel: serviceMessages.channel,
    patientId: serviceMessages.patientId,
    createdAt: serviceMessages.createdAt,
    userId: serviceMessages.userId,
    userName: users.name,
    medicalRole: users.medicalRole,
  }).from(serviceMessages)
    .leftJoin(users, eq(serviceMessages.userId, users.id))
    .where(eq(serviceMessages.serviceId, serviceId));
  return msgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
}

export async function createMessage(data: { serviceId: number; userId: number; content: string; channel?: string; patientId?: number }) {
  const db = getDb();
  const [{ id }] = await db.insert(serviceMessages).values(data as any).returning({ id: serviceMessages.id });
  return id;
}

// ===== ACTIVITY LOG =====
export async function getActivityByService(serviceId: number, limit = 50) {
  const db = getDb();
  const rows = await db.select({
    id: activityLog.id,
    action: activityLog.action,
    details: activityLog.details,
    createdAt: activityLog.createdAt,
    patientId: activityLog.patientId,
    userName: users.name,
  }).from(activityLog)
    .leftJoin(users, eq(activityLog.userId, users.id))
    .where(eq(activityLog.serviceId, serviceId));
  return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
}

export async function logActivity(data: { serviceId: number; patientId?: number; userId: number; action: string; details?: string }) {
  const db = getDb();
  await db.insert(activityLog).values(data);
}

// ===== RELEVES =====
export async function getRelevesByService(serviceId: number) {
  const db = getDb();
  const all = await db.select().from(releves).where(eq(releves.serviceId, serviceId));
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20);
}

export async function createReleve(data: { serviceId: number; generatedById: number; content: string; pdfUrl?: string }) {
  const db = getDb();
  const [{ id }] = await db.insert(releves).values(data).returning({ id: releves.id });
  return id;
}

// ===== SERVICE MEMBERS =====
export async function getServiceMembers(serviceId: number) {
  const db = getDb();
  return db.select({
    id: serviceMembers.id,
    userId: serviceMembers.userId,
    role: serviceMembers.role,
    joinedAt: serviceMembers.joinedAt,
    userName: users.name,
    medicalRole: users.medicalRole,
  }).from(serviceMembers)
    .leftJoin(users, eq(serviceMembers.userId, users.id))
    .where(eq(serviceMembers.serviceId, serviceId));
}

export async function addServiceMember(serviceId: number, userId: number, role?: "chef" | "senior" | "junior" | "stagiaire") {
  const db = getDb();
  await db.insert(serviceMembers).values({ serviceId, userId, role: role || "junior" });
}

// ===== USER PROFILE =====
export async function updateUserProfile(userId: number, data: { medicalRole?: "externe" | "interne" | "resident" | "medecin"; hospitalId?: number; name?: string }) {
  const db = getDb();
  await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, userId));
}

// ===== CONSULTATIONS =====
export async function getConsultationsByService(serviceId: number) {
  const db = getDb();
  const all = await db.select().from(consultations).where(eq(consultations.serviceId, serviceId));
  return all.sort((a, b) => new Date(b.consultDate).getTime() - new Date(a.consultDate).getTime());
}

export async function createConsultation(data: { serviceId: number; patientFirstName: string; patientLastName: string; motif: string; createdById: number; notes?: string }) {
  const db = getDb();
  const [{ id }] = await db.insert(consultations).values(data).returning({ id: consultations.id });
  return id;
}

export async function updateConsultationStatus(id: number, status: "en_attente" | "vu" | "reporte") {
  const db = getDb();
  await db.update(consultations).set({ status, updatedAt: new Date() }).where(eq(consultations.id, id));
}

// ===== CLINICAL NOTES =====
export async function getNotesByPatient(patientId: number) {
  const db = getDb();
  const all = await db.select({
    id: clinicalNotes.id,
    type: clinicalNotes.type,
    content: clinicalNotes.content,
    createdAt: clinicalNotes.createdAt,
    createdById: clinicalNotes.createdById,
    userName: users.name,
  }).from(clinicalNotes)
    .leftJoin(users, eq(clinicalNotes.createdById, users.id))
    .where(eq(clinicalNotes.patientId, patientId));
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createClinicalNote(data: { patientId: number; serviceId: number; type: "dar" | "soap" | "libre"; content: string; createdById: number }) {
  const db = getDb();
  const [{ id }] = await db.insert(clinicalNotes).values(data).returning({ id: clinicalNotes.id });
  return id;
}

// ===== VITAL SIGNS =====
export async function getVitalsByPatient(patientId: number) {
  const db = getDb();
  const all = await db.select().from(vitalSigns).where(eq(vitalSigns.patientId, patientId));
  return all.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
}

export async function createVitalSigns(data: { patientId: number; serviceId: number; recordedById: number; temperature?: string; bloodPressure?: string; heartRate?: string; respiratoryRate?: string; oxygenSaturation?: string; gcs?: string; pain?: string; notes?: string }) {
  const db = getDb();
  const [{ id }] = await db.insert(vitalSigns).values(data).returning({ id: vitalSigns.id });
  return id;
}

// ===== OBSERVATIONS =====
export async function getObservationsByPatient(patientId: number) {
  const db = getDb();
  const all = await db.select({
    id: observations.id,
    content: observations.content,
    category: observations.category,
    createdAt: observations.createdAt,
    createdById: observations.createdById,
    userName: users.name,
  }).from(observations)
    .leftJoin(users, eq(observations.createdById, users.id))
    .where(eq(observations.patientId, patientId));
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createObservation(data: { patientId: number; serviceId: number; content: string; category?: "clinique" | "infirmier" | "evolution" | "autre"; createdById: number }) {
  const db = getDb();
  const [{ id }] = await db.insert(observations).values(data).returning({ id: observations.id });
  return id;
}

// ===== ROTATIONS =====
export async function getRotationsByUser(userId: number) {
  const db = getDb();
  const all = await db.select().from(rotations).where(eq(rotations.userId, userId));
  return all.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}

export async function createRotation(data: { userId: number; serviceId: number; serviceName: string; hospitalName: string; supervisorName?: string; startDate: string; endDate?: string; notes?: string }) {
  const db = getDb();
  const [{ id }] = await db.insert(rotations).values(data).returning({ id: rotations.id });
  return id;
}

export async function updateRotation(data: { id: number; endDate?: string; supervisorName?: string; notes?: string }) {
  const db = getDb();
  await db.update(rotations).set(data).where(eq(rotations.id, data.id));
}

export async function deleteRotation(id: number) {
  const db = getDb();
  await db.delete(rotations).where(eq(rotations.id, id));
}

// ===== COMPÉTENCES =====
export async function getCompetencesByUser(userId: number) {
  const db = getDb();
  const all = await db.select({
    id: competences.id,
    title: competences.title,
    category: competences.category,
    rotationId: competences.rotationId,
    validated: competences.validated,
    validatedAt: competences.validatedAt,
    validatorName: users.name,
    notes: competences.notes,
    createdAt: competences.createdAt,
  }).from(competences)
    .leftJoin(users, eq(competences.validatedById, users.id))
    .where(eq(competences.userId, userId));
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createCompetence(data: { userId: number; title: string; category: "geste_technique" | "diagnostic" | "therapeutique" | "communication" | "autre"; rotationId?: number; notes?: string }) {
  const db = getDb();
  const [{ id }] = await db.insert(competences).values(data).returning({ id: competences.id });
  return id;
}

export async function validateCompetence(id: number, validatorId: number) {
  const db = getDb();
  await db.update(competences).set({ validated: true, validatedById: validatorId, validatedAt: new Date().toISOString() }).where(eq(competences.id, id));
}

export async function deleteCompetence(id: number) {
  const db = getDb();
  await db.delete(competences).where(eq(competences.id, id));
}

// ===== STATS PERSONNELLES =====
export async function getPersonalStats(userId: number) {
  const db = getDb();
  const [notesCount] = await db.select({ count: count() }).from(clinicalNotes).where(eq(clinicalNotes.createdById, userId));
  const [tasksCount] = await db.select({ count: count() }).from(patientTasks).where(eq(patientTasks.createdById, userId));
  const [rotationsCount] = await db.select({ count: count() }).from(rotations).where(eq(rotations.userId, userId));
  const [competencesCount] = await db.select({ count: count() }).from(competences).where(eq(competences.userId, userId));
  const [validatedCount] = await db.select({ count: count() }).from(competences).where(and(eq(competences.userId, userId), eq(competences.validated, true)));
  return {
    notes: notesCount?.count ?? 0,
    tasks: tasksCount?.count ?? 0,
    rotations: rotationsCount?.count ?? 0,
    competences: competencesCount?.count ?? 0,
    competencesValidated: validatedCount?.count ?? 0,
  };
}

export async function getNotesByUser(userId: number) {
  const db = getDb();
  const all = await db.select({
    id: clinicalNotes.id,
    type: clinicalNotes.type,
    content: clinicalNotes.content,
    patientId: clinicalNotes.patientId,
    serviceId: clinicalNotes.serviceId,
    createdAt: clinicalNotes.createdAt,
    patientName: patients.firstName,
    patientLastName: patients.lastName,
  }).from(clinicalNotes)
    .leftJoin(patients, eq(clinicalNotes.patientId, patients.id))
    .where(eq(clinicalNotes.createdById, userId));
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getTasksByUser(userId: number) {
  const db = getDb();
  const all = await db.select({
    id: patientTasks.id,
    title: patientTasks.title,
    priority: patientTasks.priority,
    status: patientTasks.status,
    dueDate: patientTasks.dueDate,
    createdAt: patientTasks.createdAt,
    patientId: patientTasks.patientId,
    patientName: patients.firstName,
    patientLastName: patients.lastName,
  }).from(patientTasks)
    .leftJoin(patients, eq(patientTasks.patientId, patients.id))
    .where(eq(patientTasks.createdById, userId));
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
