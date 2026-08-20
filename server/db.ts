import { eq, asc, desc, count, and, isNull, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "path";
import { InsertUser, users, subscriptions, payments, accountTokens, securityEvents, medicalRoleChangeRequests, medicalRoleReviews, hospitals, services, serviceMembers, serviceInvitations, joinRequests, patients, patientTasks, alerts, serviceMessages, activityLog, careDecisionProposals, guards, guardMembers, guardAssignments, releves, consultations, clinicalNotes, vitalSigns, observations, rotations, competences, procedures, personalPatients, personalNotes, personalTasks, personalVitals, personalObservations } from "../drizzle/schema";
import { patientInitials } from "../shared/patientIdentity";

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
    if (process.env.NODE_ENV === "production") throw err;
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

export async function ensureConfiguredAdmins(emails: string[]) {
  const normalized = emails.map(email => email.trim().toLowerCase()).filter(Boolean);
  if (normalized.length === 0) return;
  const db = getDb();
  await db.update(users).set({ role: "admin", updatedAt: new Date() }).where(inArray(users.email, normalized));
}

export async function createDefaultSubscription(userId: number) {
  const db = getDb();
  await db.insert(subscriptions).values({ userId }).onConflictDoNothing({ target: subscriptions.userId });
}

export async function getSubscription(userId: number) {
  const db = getDb();
  const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
  const active = Boolean(
    subscription?.status === "active" &&
    (!subscription.currentPeriodEnd || subscription.currentPeriodEnd.getTime() > Date.now()),
  );
  return {
    plan: active ? subscription!.plan : "free" as const,
    status: subscription?.status ?? "inactive",
    billingCycle: subscription?.billingCycle ?? "monthly",
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
  };
}

export async function getFreePlanUsage(userId: number) {
  const db = getDb();
  const [caseCount] = await db.select({ count: count() }).from(personalPatients).where(eq(personalPatients.userId, userId));
  const [rotationCount] = await db.select({ count: count() }).from(rotations).where(eq(rotations.userId, userId));
  const serviceRows = await db.select({ serviceName: personalPatients.serviceName }).from(personalPatients).where(eq(personalPatients.userId, userId));
  const serviceNames = [...new Set(serviceRows.map(row => row.serviceName?.trim().toLocaleLowerCase("fr-FR")).filter(Boolean))] as string[];
  return { cases: caseCount?.count ?? 0, rotations: rotationCount?.count ?? 0, serviceNames };
}

export async function createPaymentRequest(userId: number, plan: "carnet_pro" | "hall_carnet", billingCycle: "monthly" | "annual", reference: string) {
  const monthly = plan === "carnet_pro" ? 3500 : 6000;
  const amountFcfa = billingCycle === "annual" ? monthly * 10 : monthly;
  const db = getDb();
  const [{ id }] = await db.insert(payments).values({ userId, plan, billingCycle, reference, amountFcfa }).returning({ id: payments.id });
  return { id, reference, amountFcfa, provider: "wave" as const, status: "pending" as const };
}

export async function getPendingPayments() {
  const db = getDb();
  return db.select({ id: payments.id, reference: payments.reference, plan: payments.plan, billingCycle: payments.billingCycle, amountFcfa: payments.amountFcfa, status: payments.status, createdAt: payments.createdAt, userId: payments.userId, userName: users.name, userEmail: users.email })
    .from(payments).leftJoin(users, eq(payments.userId, users.id)).where(eq(payments.status, "pending")).orderBy(desc(payments.createdAt));
}

export async function confirmPayment(paymentId: number, providerTransactionId: string) {
  const db = getDb();
  return db.transaction(async tx => {
    const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId));
    if (!payment) throw new Error("Paiement introuvable");
    if (payment.status !== "pending") throw new Error("Ce paiement a déjà été traité");
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + (payment.billingCycle === "annual" ? 12 : 1));
    await tx.update(payments).set({ status: "paid", providerTransactionId, paidAt: new Date() }).where(eq(payments.id, paymentId));
    await tx.insert(subscriptions).values({ userId: payment.userId, plan: payment.plan, status: "active", billingCycle: payment.billingCycle, provider: payment.provider, providerSubscriptionId: providerTransactionId, currentPeriodEnd: periodEnd })
      .onConflictDoUpdate({ target: subscriptions.userId, set: { plan: payment.plan, status: "active", billingCycle: payment.billingCycle, provider: payment.provider, providerSubscriptionId: providerTransactionId, currentPeriodEnd: periodEnd, updatedAt: new Date() } });
    return { success: true, userId: payment.userId, plan: payment.plan, currentPeriodEnd: periodEnd };
  });
}

export async function createAccountToken(userId: number, kind: "password_reset" | "email_verification", tokenHash: string, expiresAt: Date) {
  const db = getDb();
  await db.insert(accountTokens).values({ userId, kind, tokenHash, expiresAt });
}

export async function consumeAccountToken(tokenHash: string, kind: "password_reset" | "email_verification") {
  const db = getDb();
  const [token] = await db.select().from(accountTokens).where(and(eq(accountTokens.tokenHash, tokenHash), eq(accountTokens.kind, kind), isNull(accountTokens.usedAt)));
  if (!token || token.expiresAt.getTime() <= Date.now()) return null;
  await db.update(accountTokens).set({ usedAt: new Date() }).where(eq(accountTokens.id, token.id));
  return token;
}

export async function updatePassword(userId: number, passwordHash: string) {
  const db = getDb();
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function verifyUserEmail(userId: number) {
  const db = getDb();
  await db.update(users).set({ emailVerified: true, emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function requestAccountDeletion(userId: number) {
  const db = getDb();
  await db.update(users).set({ deletionRequestedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function logSecurityEvent(userId: number | null, eventType: string, details?: string) {
  const db = getDb();
  await db.insert(securityEvents).values({ userId: userId ?? undefined, eventType, details });
}

export async function getPersonalDataExport(userId: number) {
  const db = getDb();
  const [profile] = await db.select({ id: users.id, name: users.name, email: users.email, medicalRole: users.medicalRole, hospitalId: users.hospitalId, createdAt: users.createdAt }).from(users).where(eq(users.id, userId));
  const [plan, userRotations, userCompetences, userProcedures, cases, notes, tasks, vitals, observations] = await Promise.all([
    getSubscription(userId),
    db.select().from(rotations).where(eq(rotations.userId, userId)),
    db.select().from(competences).where(eq(competences.userId, userId)),
    db.select().from(procedures).where(eq(procedures.userId, userId)),
    db.select().from(personalPatients).where(eq(personalPatients.userId, userId)),
    db.select().from(personalNotes).where(eq(personalNotes.userId, userId)),
    db.select().from(personalTasks).where(eq(personalTasks.userId, userId)),
    db.select().from(personalVitals).where(eq(personalVitals.userId, userId)),
    db.select().from(personalObservations).where(eq(personalObservations.userId, userId)),
  ]);
  return { exportedAt: new Date().toISOString(), profile, subscription: plan, carnet: { rotations: userRotations, competences: userCompetences, procedures: userProcedures, cases: cases.map(anonymizePersonalPatient), notes, tasks, vitals, observations } };
}

// ===== HOSPITALS =====
export async function getHospitals() {
  const db = getDb();
  return db.select().from(hospitals).orderBy(asc(hospitals.name));
}

export async function createHospital(name: string, city: string) {
  const db = getDb();
  const [{ id }] = await db.insert(hospitals).values({ name, city }).returning({ id: hospitals.id });
  return { id, name, city };
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

function generateServiceCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createService(data: { name: string; specialty: string; hospitalId: number; createdById: number; totalBeds?: number; description?: string; creatorProvisional?: boolean }) {
  const db = getDb();
  const code = generateServiceCode();
  const { creatorProvisional, ...serviceData } = data;
  const [{ id }] = await db.insert(services).values({ ...serviceData, code }).returning({ id: services.id });
  await db.insert(serviceMembers).values({ serviceId: id, userId: data.createdById, role: "chef", provisional: creatorProvisional ?? false });
  return { id, code };
}

export async function getServiceByCode(code: string) {
  const db = getDb();
  const [s] = await db.select().from(services).where(eq(services.code, code.toUpperCase()));
  return s;
}

export async function isServiceMember(serviceId: number, userId: number) {
  const db = getDb();
  const [m] = await db.select().from(serviceMembers).where(and(eq(serviceMembers.serviceId, serviceId), eq(serviceMembers.userId, userId)));
  return !!m;
}

export async function isServiceChef(serviceId: number, userId: number) {
  const db = getDb();
  const [membership] = await db.select({ role: serviceMembers.role })
    .from(serviceMembers)
    .where(and(eq(serviceMembers.serviceId, serviceId), eq(serviceMembers.userId, userId)));
  return membership?.role === "chef";
}

export async function joinService(
  serviceId: number,
  userId: number,
  options?: { autoApprove?: boolean; medicalRole?: "externe" | "interne" | "resident" | "medecin" | null; provisional?: boolean },
) {
  const db = getDb();
  const alreadyMember = await isServiceMember(serviceId, userId);
  if (alreadyMember) return { status: "already_member", provisional: false };
  const [existing] = await db.select().from(joinRequests).where(and(eq(joinRequests.serviceId, serviceId), eq(joinRequests.userId, userId)));
  if (options?.autoApprove) {
    const memberRole = options.medicalRole === "medecin" || options.medicalRole === "resident" ? "senior" : "junior";
    await db.insert(serviceMembers).values({ serviceId, userId, role: memberRole, provisional: options.provisional ?? false });
    if (existing) {
      await db.update(joinRequests).set({ status: "approved", resolvedAt: new Date(), resolvedById: userId }).where(eq(joinRequests.id, existing.id));
    }
    await logActivity({
      serviceId,
      userId,
      action: options.provisional ? "member_provisional_joined" : "member_auto_joined",
      details: options.provisional ? "Accès provisoire par invitation sécurisée" : "Accès automatique : rôle déjà confirmé dans le même hôpital",
    });
    return { status: "joined", provisional: options.provisional ?? false };
  }
  if (existing) return { status: "pending", provisional: false };
  await db.insert(joinRequests).values({ serviceId, userId });
  return { status: "pending", provisional: false };
}

export async function createServiceInvitation(data: { serviceId: number; tokenHash: string; createdById: number; expiresAt: Date; maxUses?: number }) {
  const db = getDb();
  const [invitation] = await db.insert(serviceInvitations).values(data).returning();
  return invitation;
}

export async function getServiceInvitation(tokenHash: string) {
  const db = getDb();
  const [invitation] = await db.select().from(serviceInvitations).where(eq(serviceInvitations.tokenHash, tokenHash));
  return invitation ?? null;
}

export async function recordServiceInvitationUse(invitationId: number, usedCount: number) {
  const db = getDb();
  await db.update(serviceInvitations).set({ usedCount: usedCount + 1 }).where(eq(serviceInvitations.id, invitationId));
}

export async function getPendingRequests(serviceId: number) {
  const db = getDb();
  return db.select({
    id: joinRequests.id,
    userId: joinRequests.userId,
    userName: users.name,
    userEmail: users.email,
    medicalRole: users.medicalRole,
    createdAt: joinRequests.createdAt,
  }).from(joinRequests)
    .leftJoin(users, eq(joinRequests.userId, users.id))
    .where(and(eq(joinRequests.serviceId, serviceId), eq(joinRequests.status, "pending")));
}

export async function getJoinRequestById(requestId: number) {
  const db = getDb();
  const [request] = await db.select().from(joinRequests).where(eq(joinRequests.id, requestId));
  return request ?? null;
}

export async function resolveJoinRequest(requestId: number, approved: boolean, resolvedById: number, verifyMedicalRole = false) {
  const db = getDb();
  const [req] = await db.select().from(joinRequests).where(eq(joinRequests.id, requestId));
  if (!req) return;
  await db.update(joinRequests).set({ status: approved ? "approved" : "rejected", resolvedAt: new Date(), resolvedById }).where(eq(joinRequests.id, requestId));
  if (approved) {
    const [memberUser] = await db.select({ medicalRole: users.medicalRole }).from(users).where(eq(users.id, req.userId));
    const memberRole = memberUser?.medicalRole === "medecin" || memberUser?.medicalRole === "resident"
      ? "senior"
      : memberUser?.medicalRole === "externe"
        ? "stagiaire"
        : "junior";
    await db.insert(serviceMembers).values({
      serviceId: req.serviceId,
      userId: req.userId,
      role: memberRole,
      provisional: memberRole !== "stagiaire" && !verifyMedicalRole,
    });
    if (verifyMedicalRole) {
      await db.update(users).set({
        medicalRoleVerified: true,
        medicalRoleVerifiedById: resolvedById,
        medicalRoleVerifiedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(users.id, req.userId));
    }
    await logActivity({ serviceId: req.serviceId, userId: req.userId, action: "member_joined", details: null as any });
  }
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

export async function searchPatients(query: string) {
  const db = getDb();
  const all = await db.select({
    id: patients.id,
    firstName: patients.firstName,
    lastName: patients.lastName,
    diagnosis: patients.diagnosis,
    status: patients.status,
    serviceId: patients.serviceId,
    serviceName: services.name,
  }).from(patients)
    .leftJoin(services, eq(patients.serviceId, services.id))
    .where(eq(patients.actualDischarge, null as any));
  const q = query.toLowerCase();
  return all.filter(p =>
    p.firstName.toLowerCase().includes(q) ||
    p.lastName.toLowerCase().includes(q)
  ).slice(0, 10);
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
  dischargeDisposition: "sortie" | "refere" | null;
  referralDestination: string | null; referralReason: string | null; referralDate: Date | null;
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

export async function getTaskById(taskId: number) {
  const db = getDb();
  const [task] = await db.select().from(patientTasks).where(eq(patientTasks.id, taskId));
  return task ?? null;
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

export async function getAlertById(alertId: number) {
  const db = getDb();
  const [alert] = await db.select().from(alerts).where(eq(alerts.id, alertId));
  return alert ?? null;
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

export async function getServiceMemberRole(serviceId: number, userId: number) {
  const db = getDb();
  const [membership] = await db.select({ role: serviceMembers.role }).from(serviceMembers)
    .where(and(eq(serviceMembers.serviceId, serviceId), eq(serviceMembers.userId, userId)));
  return membership?.role ?? null;
}

export async function getServiceMembership(serviceId: number, userId: number) {
  const db = getDb();
  const [membership] = await db.select({ role: serviceMembers.role, provisional: serviceMembers.provisional })
    .from(serviceMembers)
    .where(and(eq(serviceMembers.serviceId, serviceId), eq(serviceMembers.userId, userId)));
  return membership ?? null;
}

export async function resolvePatientAlerts(patientId: number, type: "dps_missing" | "no_bed" | "task_overdue" | "critical_patient", userId: number) {
  const db = getDb();
  await db.update(alerts)
    .set({ resolved: true, resolvedAt: new Date().toISOString(), resolvedById: userId })
    .where(and(eq(alerts.patientId, patientId), eq(alerts.type, type), eq(alerts.resolved, false)));
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
    patientFirstName: patients.firstName,
    patientLastName: patients.lastName,
    patientBedNumber: patients.bedNumber,
  }).from(serviceMessages)
    .leftJoin(users, eq(serviceMessages.userId, users.id))
    .leftJoin(patients, eq(serviceMessages.patientId, patients.id))
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

// ===== PROPOSITIONS DE DÉCISION CLINIQUE =====
export async function createCareDecisionProposal(data: {
  serviceId: number;
  subjectType: "patient" | "consultation";
  subjectId: number;
  decisionType: "sortie" | "refere" | "hospitalise";
  destination?: string;
  reason?: string;
  bedNumber?: number;
  patientStatus?: "stable" | "modere" | "critique";
  urgency?: "normal" | "urgent";
  assignedReviewerId?: number;
  proposedById: number;
}) {
  const db = getDb();
  const [{ id }] = await db.insert(careDecisionProposals).values(data).returning({ id: careDecisionProposals.id });
  return id;
}

export async function getCareDecisionProposal(id: number) {
  const db = getDb();
  const [proposal] = await db.select().from(careDecisionProposals).where(eq(careDecisionProposals.id, id));
  return proposal ?? null;
}

export async function getCareDecisionProposals(serviceId: number, pendingOnly = false) {
  const db = getDb();
  let rows = await db.select({
    id: careDecisionProposals.id,
    serviceId: careDecisionProposals.serviceId,
    subjectType: careDecisionProposals.subjectType,
    subjectId: careDecisionProposals.subjectId,
    decisionType: careDecisionProposals.decisionType,
    destination: careDecisionProposals.destination,
    reason: careDecisionProposals.reason,
    bedNumber: careDecisionProposals.bedNumber,
    patientStatus: careDecisionProposals.patientStatus,
    urgency: careDecisionProposals.urgency,
    assignedReviewerId: careDecisionProposals.assignedReviewerId,
    status: careDecisionProposals.status,
    proposedById: careDecisionProposals.proposedById,
    proposerName: users.name,
    reviewedById: careDecisionProposals.reviewedById,
    reviewNote: careDecisionProposals.reviewNote,
    createdAt: careDecisionProposals.createdAt,
    reviewedAt: careDecisionProposals.reviewedAt,
  }).from(careDecisionProposals)
    .leftJoin(users, eq(careDecisionProposals.proposedById, users.id))
    .where(eq(careDecisionProposals.serviceId, serviceId));
  if (pendingOnly) rows = rows.filter(row => row.status === "pending");
  const enriched = await Promise.all(rows.map(async row => {
    if (row.subjectType === "patient") {
      const patient = await getPatientById(row.subjectId);
      return { ...row, subjectName: patient ? patientInitials(patient.firstName, patient.lastName) : `Patient #${row.subjectId}`, subjectBedNumber: patient?.bedNumber ?? null };
    }
    const consultation = await getConsultationById(row.subjectId);
    return { ...row, subjectName: consultation ? patientInitials(consultation.patientFirstName, consultation.patientLastName) : `Consultation #${row.subjectId}`, subjectBedNumber: null };
  }));
  return enriched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function reviewCareDecisionProposal(id: number, data: {
  status: "approved" | "rejected";
  reviewedById: number;
  reviewNote?: string;
}) {
  const db = getDb();
  const claimed = await db.update(careDecisionProposals).set({ ...data, reviewedAt: new Date() })
    .where(and(eq(careDecisionProposals.id, id), eq(careDecisionProposals.status, "pending")))
    .returning({ id: careDecisionProposals.id });
  return claimed.length === 1;
}

export async function resetCareDecisionProposal(id: number) {
  const db = getDb();
  await db.update(careDecisionProposals).set({
    status: "pending", reviewedById: null, reviewNote: null, reviewedAt: null,
  }).where(eq(careDecisionProposals.id, id));
}

// ===== GARDES =====
export async function getGuardsByService(serviceId: number) {
  const db = getDb();
  const rows = await db.select().from(guards).where(eq(guards.serviceId, serviceId)).orderBy(desc(guards.startsAt));
  return Promise.all(rows.map(async guard => {
    const members = await db.select({
      id: guardMembers.id, userId: guardMembers.userId, dutyRole: guardMembers.dutyRole,
      userName: users.name, medicalRole: users.medicalRole,
    }).from(guardMembers).leftJoin(users, eq(guardMembers.userId, users.id)).where(eq(guardMembers.guardId, guard.id));
    const assignments = await db.select({
      id: guardAssignments.id, patientId: guardAssignments.patientId, assignedToId: guardAssignments.assignedToId,
      notes: guardAssignments.notes, patientFirstName: patients.firstName, patientLastName: patients.lastName,
      bedNumber: patients.bedNumber,
    }).from(guardAssignments).leftJoin(patients, eq(guardAssignments.patientId, patients.id)).where(eq(guardAssignments.guardId, guard.id));
    return { ...guard, members, assignments };
  }));
}

export async function createGuard(data: { serviceId: number; startsAt: Date; endsAt: Date; supervisorId?: number; createdById: number; memberIds?: number[] }) {
  const db = getDb();
  const { memberIds, ...guardData } = data;
  const [{ id }] = await db.insert(guards).values(guardData).returning({ id: guards.id });
  const uniqueMembers = Array.from(new Set([data.createdById, data.supervisorId, ...(memberIds || [])].filter(Boolean) as number[]));
  if (uniqueMembers.length) await db.insert(guardMembers).values(uniqueMembers.map(userId => ({
    guardId: id, userId, dutyRole: userId === data.supervisorId ? "supervisor" as const : "clinician" as const,
  })));
  return id;
}

export async function updateGuardStatus(id: number, serviceId: number, status: "active" | "ended", summary?: string) {
  const db = getDb();
  await db.update(guards).set({ status, summary }).where(and(eq(guards.id, id), eq(guards.serviceId, serviceId)));
}

export async function addGuardMember(guardId: number, userId: number, dutyRole: "student" | "clinician" | "supervisor") {
  const db = getDb();
  await db.insert(guardMembers).values({ guardId, userId, dutyRole });
}

export async function assignGuardPatient(guardId: number, patientId: number, assignedToId: number, notes?: string) {
  const db = getDb();
  const [{ id }] = await db.insert(guardAssignments).values({ guardId, patientId, assignedToId, notes }).returning({ id: guardAssignments.id });
  return id;
}

export async function getGuardById(id: number) {
  const db = getDb();
  const [guard] = await db.select().from(guards).where(eq(guards.id, id));
  return guard ?? null;
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
    provisional: serviceMembers.provisional,
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

export async function leaveService(serviceId: number, userId: number) {
  const db = getDb();
  await db.delete(serviceMembers).where(and(eq(serviceMembers.serviceId, serviceId), eq(serviceMembers.userId, userId)));
}

// ===== USER PROFILE =====
export async function updateUserProfile(userId: number, data: { medicalRole?: "externe" | "interne" | "resident" | "medecin"; hospitalId?: number; name?: string }) {
  const db = getDb();
  await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, userId));
}

type MedicalRole = "externe" | "interne" | "resident" | "medecin";

export async function getPendingMedicalRoleChangeRequest(userId: number) {
  const db = getDb();
  const [request] = await db.select().from(medicalRoleChangeRequests)
    .where(and(eq(medicalRoleChangeRequests.userId, userId), eq(medicalRoleChangeRequests.status, "pending")))
    .orderBy(desc(medicalRoleChangeRequests.createdAt));
  return request ?? null;
}

export async function getMedicalRoleChangeRequest(requestId: number) {
  const db = getDb();
  const [request] = await db.select().from(medicalRoleChangeRequests).where(eq(medicalRoleChangeRequests.id, requestId));
  return request ?? null;
}

export async function createMedicalRoleChangeRequest(data: { userId: number; currentRole: MedicalRole; requestedRole: MedicalRole; reason: string }) {
  const db = getDb();
  const [request] = await db.insert(medicalRoleChangeRequests).values(data).returning();
  return request;
}

export async function cancelMedicalRoleChangeRequest(requestId: number, userId: number) {
  const db = getDb();
  await db.update(medicalRoleChangeRequests).set({ status: "canceled", resolvedAt: new Date() })
    .where(and(eq(medicalRoleChangeRequests.id, requestId), eq(medicalRoleChangeRequests.userId, userId), eq(medicalRoleChangeRequests.status, "pending")));
}

export async function getMedicalRoleChangeHistory(userId: number) {
  const db = getDb();
  return db.select().from(medicalRoleChangeRequests)
    .where(eq(medicalRoleChangeRequests.userId, userId))
    .orderBy(desc(medicalRoleChangeRequests.createdAt));
}

export async function getPendingMedicalRoleChangesForService(serviceId: number) {
  const db = getDb();
  const memberRows = await db.select({ userId: serviceMembers.userId }).from(serviceMembers).where(eq(serviceMembers.serviceId, serviceId));
  const userIds = memberRows.map(member => member.userId);
  if (!userIds.length) return [];
  return db.select({
    id: medicalRoleChangeRequests.id,
    userId: medicalRoleChangeRequests.userId,
    userName: users.name,
    currentRole: medicalRoleChangeRequests.currentRole,
    requestedRole: medicalRoleChangeRequests.requestedRole,
    reason: medicalRoleChangeRequests.reason,
    createdAt: medicalRoleChangeRequests.createdAt,
  }).from(medicalRoleChangeRequests)
    .leftJoin(users, eq(medicalRoleChangeRequests.userId, users.id))
    .where(and(inArray(medicalRoleChangeRequests.userId, userIds), eq(medicalRoleChangeRequests.status, "pending")))
    .orderBy(asc(medicalRoleChangeRequests.createdAt));
}

export async function getProvisionalMedicalRoleMembers(serviceId: number) {
  const db = getDb();
  return db.select({
    userId: serviceMembers.userId,
    userName: users.name,
    medicalRole: users.medicalRole,
    joinedAt: serviceMembers.joinedAt,
  }).from(serviceMembers)
    .leftJoin(users, eq(serviceMembers.userId, users.id))
    .where(and(eq(serviceMembers.serviceId, serviceId), eq(serviceMembers.provisional, true)));
}

export async function getMedicalRoleReview(data: { targetUserId: number; reviewerId: number; serviceId: number; kind: "initial_verification" | "role_change"; requestId?: number }) {
  const db = getDb();
  const conditions = [
    eq(medicalRoleReviews.targetUserId, data.targetUserId),
    eq(medicalRoleReviews.reviewerId, data.reviewerId),
    eq(medicalRoleReviews.serviceId, data.serviceId),
    eq(medicalRoleReviews.kind, data.kind),
    data.requestId ? eq(medicalRoleReviews.requestId, data.requestId) : isNull(medicalRoleReviews.requestId),
  ];
  const [review] = await db.select().from(medicalRoleReviews).where(and(...conditions));
  return review ?? null;
}

export async function createMedicalRoleReview(data: {
  targetUserId: number;
  reviewerId: number;
  serviceId: number;
  requestId?: number;
  kind: "initial_verification" | "role_change";
  decision: "approved" | "rejected";
  reviewerMedicalRole: "resident" | "medecin";
  note?: string;
}) {
  const db = getDb();
  const [review] = await db.insert(medicalRoleReviews).values(data).returning();
  return review;
}

export async function getMedicalRoleReviews(targetUserId: number, serviceId: number, kind: "initial_verification" | "role_change", requestId?: number) {
  const db = getDb();
  return db.select().from(medicalRoleReviews).where(and(
    eq(medicalRoleReviews.targetUserId, targetUserId),
    eq(medicalRoleReviews.serviceId, serviceId),
    eq(medicalRoleReviews.kind, kind),
    requestId ? eq(medicalRoleReviews.requestId, requestId) : isNull(medicalRoleReviews.requestId),
  ));
}

export async function confirmMedicalRole(userId: number, verifierId: number, serviceId: number) {
  const db = getDb();
  await db.update(users).set({
    medicalRoleVerified: true,
    medicalRoleVerifiedById: verifierId,
    medicalRoleVerifiedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(users.id, userId));
  await db.update(serviceMembers).set({ provisional: false })
    .where(and(eq(serviceMembers.userId, userId), eq(serviceMembers.serviceId, serviceId)));
}

export async function resolveMedicalRoleChange(requestId: number, reviewerId: number, approved: boolean, resolutionNote?: string) {
  const db = getDb();
  const request = await getMedicalRoleChangeRequest(requestId);
  if (!request || request.status !== "pending") return false;
  await db.update(medicalRoleChangeRequests).set({
    status: approved ? "approved" : "rejected",
    resolvedById: reviewerId,
    resolutionNote: resolutionNote || null,
    resolvedAt: new Date(),
  }).where(eq(medicalRoleChangeRequests.id, requestId));
  if (approved) {
    const memberRole = request.requestedRole === "medecin" || request.requestedRole === "resident"
      ? "senior"
      : request.requestedRole === "externe" ? "stagiaire" : "junior";
    await db.update(users).set({
      medicalRole: request.requestedRole,
      medicalRoleVerified: true,
      medicalRoleVerifiedById: reviewerId,
      medicalRoleVerifiedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(users.id, request.userId));
    await db.update(serviceMembers).set({ role: memberRole, provisional: false }).where(eq(serviceMembers.userId, request.userId));
  }
  return true;
}

// ===== CONSULTATIONS =====
export async function getConsultationsByService(serviceId: number) {
  const db = getDb();
  const all = await db.select().from(consultations).where(eq(consultations.serviceId, serviceId));
  return all.sort((a, b) => new Date(b.consultDate).getTime() - new Date(a.consultDate).getTime());
}

export async function getConsultationById(id: number) {
  const db = getDb();
  const [consultation] = await db.select().from(consultations).where(eq(consultations.id, id));
  return consultation ?? null;
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

export async function updateConsultationDetails(id: number, data: {
  rapport?: string;
  examensPara?: string;
  rendezVous?: Date | null;
  status?: "en_attente" | "vu" | "reporte";
  disposition?: "hospitalise" | "refere" | "sortie" | null;
  linkedPatientId?: number | null;
  referralDestination?: string | null;
  referralReason?: string | null;
  closedAt?: Date | null;
}) {
  const db = getDb();
  await db.update(consultations).set({ ...data, updatedAt: new Date() }).where(eq(consultations.id, id));
}

export async function getConsultationHistory(serviceId: number, firstName: string, lastName: string) {
  const db = getDb();
  const all = await db.select().from(consultations)
    .where(and(
      eq(consultations.serviceId, serviceId),
      eq(consultations.patientFirstName, firstName),
      eq(consultations.patientLastName, lastName)
    ))
    .orderBy(desc(consultations.consultDate));
  return all;
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
    supersedesNoteId: clinicalNotes.supersedesNoteId,
    correctionReason: clinicalNotes.correctionReason,
    userName: users.name,
  }).from(clinicalNotes)
    .leftJoin(users, eq(clinicalNotes.createdById, users.id))
    .where(eq(clinicalNotes.patientId, patientId));
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createClinicalNote(data: { patientId: number; serviceId: number; type: "dar" | "soap" | "libre"; content: string; createdById: number; supersedesNoteId?: number; correctionReason?: string }) {
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

export async function getRotationById(id: number) {
  const db = getDb();
  const [rotation] = await db.select().from(rotations).where(eq(rotations.id, id));
  return rotation ?? null;
}

export async function createRotation(data: { userId: number; serviceId: number; serviceName: string; hospitalName: string; supervisorName?: string; startDate: string; endDate?: string; notes?: string }) {
  const db = getDb();
  const [{ id }] = await db.insert(rotations).values(data).returning({ id: rotations.id });
  return id;
}

export async function updateRotation(userId: number, data: { id: number; endDate?: string; supervisorName?: string; notes?: string }) {
  const db = getDb();
  await db.update(rotations).set(data).where(and(eq(rotations.id, data.id), eq(rotations.userId, userId)));
}

export async function deleteRotation(id: number, userId: number) {
  const db = getDb();
  await db.delete(rotations).where(and(eq(rotations.id, id), eq(rotations.userId, userId)));
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

export async function getCompetenceById(id: number) {
  const db = getDb();
  const [competence] = await db.select().from(competences).where(eq(competences.id, id));
  return competence ?? null;
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

export async function deleteCompetence(id: number, userId: number) {
  const db = getDb();
  await db.delete(competences).where(and(eq(competences.id, id), eq(competences.userId, userId)));
}

// ===== GESTES / PROCÉDURES DU CARNET =====
export async function getProceduresByUser(userId: number) {
  const db = getDb();
  return db.select({
    id: procedures.id, rotationId: procedures.rotationId, personalPatientId: procedures.personalPatientId,
    title: procedures.title, performedAt: procedures.performedAt, participationLevel: procedures.participationLevel,
    outcome: procedures.outcome, attempts: procedures.attempts, reflection: procedures.reflection,
    validated: procedures.validated, validatedById: procedures.validatedById, validatedAt: procedures.validatedAt,
    validatorComment: procedures.validatorComment, validatorName: users.name, createdAt: procedures.createdAt,
  }).from(procedures).leftJoin(users, eq(procedures.validatedById, users.id))
    .where(eq(procedures.userId, userId)).orderBy(desc(procedures.performedAt));
}

export async function getProcedureById(id: number) {
  const db = getDb();
  const [procedure] = await db.select().from(procedures).where(eq(procedures.id, id));
  return procedure ?? null;
}

export async function createProcedure(data: {
  userId: number; rotationId?: number; personalPatientId?: number; title: string; performedAt?: Date;
  participationLevel: "observed" | "assisted" | "supervised" | "autonomous";
  outcome?: "success" | "partial" | "failed"; attempts?: number; reflection?: string;
}) {
  const db = getDb();
  const [{ id }] = await db.insert(procedures).values(data).returning({ id: procedures.id });
  return id;
}

export async function validateProcedure(id: number, validatorId: number, validatorComment?: string) {
  const db = getDb();
  await db.update(procedures).set({ validated: true, validatedById: validatorId, validatedAt: new Date(), validatorComment })
    .where(eq(procedures.id, id));
}

export async function deleteProcedure(id: number, userId: number) {
  const db = getDb();
  await db.delete(procedures).where(and(eq(procedures.id, id), eq(procedures.userId, userId), eq(procedures.validated, false)));
}

// ===== STATS PERSONNELLES =====
export async function getPersonalStats(userId: number) {
  const db = getDb();
  const [notesCount] = await db.select({ count: count() }).from(clinicalNotes).where(eq(clinicalNotes.createdById, userId));
  const [tasksCount] = await db.select({ count: count() }).from(patientTasks).where(eq(patientTasks.createdById, userId));
  const [rotationsCount] = await db.select({ count: count() }).from(rotations).where(eq(rotations.userId, userId));
  const [competencesCount] = await db.select({ count: count() }).from(competences).where(eq(competences.userId, userId));
  const [validatedCount] = await db.select({ count: count() }).from(competences).where(and(eq(competences.userId, userId), eq(competences.validated, true)));
  const [proceduresCount] = await db.select({ count: count() }).from(procedures).where(eq(procedures.userId, userId));
  const [validatedProceduresCount] = await db.select({ count: count() }).from(procedures).where(and(eq(procedures.userId, userId), eq(procedures.validated, true)));
  return {
    notes: notesCount?.count ?? 0,
    tasks: tasksCount?.count ?? 0,
    rotations: rotationsCount?.count ?? 0,
    competences: competencesCount?.count ?? 0,
    competencesValidated: validatedCount?.count ?? 0,
    procedures: proceduresCount?.count ?? 0,
    proceduresValidated: validatedProceduresCount?.count ?? 0,
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

// ===== PATIENTS PERSONNELS =====
function toInitial(value: string | null | undefined) {
  const letter = value?.trim().charAt(0).toLocaleUpperCase("fr-FR");
  return letter ? `${letter}.` : "X.";
}

export async function getClinicalNoteById(id: number) {
  const db = getDb();
  const [note] = await db.select().from(clinicalNotes).where(eq(clinicalNotes.id, id));
  return note ?? null;
}

export async function userHasServiceMembership(userId: number) {
  const db = getDb();
  const [membership] = await db.select({ id: serviceMembers.id }).from(serviceMembers).where(eq(serviceMembers.userId, userId));
  return !!membership;
}

function anonymizePersonalPatient<T extends { firstName: string; lastName: string; dateOfBirth?: string | null; phone?: string | null }>(patient: T) {
  return { ...patient, firstName: toInitial(patient.firstName), lastName: toInitial(patient.lastName), dateOfBirth: null, phone: null };
}

export async function getPersonalPatients(userId: number) {
  const db = getDb();
  const rows = await db.select().from(personalPatients)
    .where(and(eq(personalPatients.userId, userId), eq(personalPatients.discharged, false)))
    .orderBy(desc(personalPatients.createdAt));
  return rows.map(anonymizePersonalPatient);
}

export async function getPersonalPatient(id: number, userId: number) {
  const db = getDb();
  const [p] = await db.select().from(personalPatients)
    .where(and(eq(personalPatients.id, id), eq(personalPatients.userId, userId)));
  return p ? anonymizePersonalPatient(p) : undefined;
}

export async function createPersonalPatient(data: { userId: number; firstName: string; lastName: string; dateOfBirth?: string; gender?: "M" | "F"; phone?: string; status?: "stable" | "modere" | "critique"; diagnosis?: string; allergies?: string; antecedents?: string; serviceName?: string; bedNumber?: number; encounterType?: "consultation" | "hospitalisation"; anonymousCode?: string; sourcePatientId?: number }) {
  const db = getDb();
  const [{ id }] = await db.insert(personalPatients).values({
    ...data,
    firstName: toInitial(data.firstName),
    lastName: toInitial(data.lastName),
    dateOfBirth: undefined,
    phone: undefined,
  }).returning({ id: personalPatients.id });
  return id;
}

export async function personalPatientExistsForSource(userId: number, sourcePatientId: number) {
  const db = getDb();
  const [row] = await db.select({ id: personalPatients.id }).from(personalPatients)
    .where(and(eq(personalPatients.userId, userId), eq(personalPatients.sourcePatientId, sourcePatientId)));
  return row?.id ?? null;
}

export async function updatePersonalPatient(id: number, userId: number, data: { status?: "stable" | "modere" | "critique"; diagnosis?: string; discharged?: boolean }) {
  const db = getDb();
  await db.update(personalPatients).set({ ...data, updatedAt: new Date() })
    .where(and(eq(personalPatients.id, id), eq(personalPatients.userId, userId)));
}

export async function deletePersonalPatient(id: number, userId: number) {
  const db = getDb();
  await db.delete(personalPatients).where(and(eq(personalPatients.id, id), eq(personalPatients.userId, userId)));
}

// Notes personnelles
export async function getPersonalNotes(personalPatientId: number, userId: number) {
  const db = getDb();
  return db.select().from(personalNotes)
    .where(and(eq(personalNotes.personalPatientId, personalPatientId), eq(personalNotes.userId, userId)))
    .orderBy(desc(personalNotes.createdAt));
}

export async function createPersonalNote(data: { userId: number; personalPatientId: number; type: "dar" | "soap" | "libre"; content: string }) {
  const db = getDb();
  const [{ id }] = await db.insert(personalNotes).values(data).returning({ id: personalNotes.id });
  return id;
}

export async function deletePersonalNote(id: number, userId: number) {
  const db = getDb();
  await db.delete(personalNotes).where(and(eq(personalNotes.id, id), eq(personalNotes.userId, userId)));
}

// Tâches personnelles
export async function getPersonalTasks(personalPatientId: number, userId: number) {
  const db = getDb();
  return db.select().from(personalTasks)
    .where(and(eq(personalTasks.personalPatientId, personalPatientId), eq(personalTasks.userId, userId)))
    .orderBy(asc(personalTasks.createdAt));
}

export async function createPersonalTask(data: { userId: number; personalPatientId: number; title: string; description?: string; priority?: "low" | "medium" | "high" | "urgent" }) {
  const db = getDb();
  const [{ id }] = await db.insert(personalTasks).values(data).returning({ id: personalTasks.id });
  return id;
}

export async function completePersonalTask(id: number, userId: number) {
  const db = getDb();
  await db.update(personalTasks).set({ status: "completed", completedAt: new Date() })
    .where(and(eq(personalTasks.id, id), eq(personalTasks.userId, userId)));
}

export async function deletePersonalTask(id: number, userId: number) {
  const db = getDb();
  await db.delete(personalTasks).where(and(eq(personalTasks.id, id), eq(personalTasks.userId, userId)));
}

// Vitaux personnels
export async function getPersonalVitals(personalPatientId: number, userId: number) {
  const db = getDb();
  return db.select().from(personalVitals)
    .where(and(eq(personalVitals.personalPatientId, personalPatientId), eq(personalVitals.userId, userId)))
    .orderBy(desc(personalVitals.recordedAt));
}

export async function createPersonalVitals(data: { userId: number; personalPatientId: number; temperature?: string; bloodPressure?: string; heartRate?: string; respiratoryRate?: string; oxygenSaturation?: string; gcs?: string; pain?: string; notes?: string }) {
  const db = getDb();
  const [{ id }] = await db.insert(personalVitals).values(data).returning({ id: personalVitals.id });
  return id;
}

// Observations personnelles
export async function getPersonalObservations(personalPatientId: number, userId: number) {
  const db = getDb();
  return db.select().from(personalObservations)
    .where(and(eq(personalObservations.personalPatientId, personalPatientId), eq(personalObservations.userId, userId)))
    .orderBy(desc(personalObservations.createdAt));
}

export async function createPersonalObservation(data: { userId: number; personalPatientId: number; content: string; category?: "clinique" | "infirmier" | "evolution" | "autre" }) {
  const db = getDb();
  const [{ id }] = await db.insert(personalObservations).values(data).returning({ id: personalObservations.id });
  return id;
}
