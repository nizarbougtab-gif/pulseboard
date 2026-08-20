import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { ENV } from "./_core/env";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { canAutoJoinService, canDo, canJoinImmediatelyWithInvitation, canReviewMedicalRole, medicalRoleReviewApproved, type Permission } from "../shared/permissions";
import { patientInitials, sanitizePatientInitial } from "../shared/patientIdentity";
import { createHash } from "node:crypto";

const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const FORBIDDEN_MESSAGE = "Vous n'avez pas accès à cette ressource";

function normalizePatientInitial(value: string) {
  const initial = sanitizePatientInitial(value);
  if (!initial) throw new TRPCError({ code: "BAD_REQUEST", message: "Une initiale valide est obligatoire" });
  return initial;
}

async function makeSessionToken(openId: string, name: string) {
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 32) {
    throw new Error("JWT_SECRET doit contenir au moins 32 caractères");
  }
  const secret = new TextEncoder().encode(ENV.cookieSecret);
  return new SignJWT({ openId, name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("pulseboard")
    .setAudience("pulseboard-web")
    .setExpirationTime("12h")
    .sign(secret);
}

async function requireServiceMember(serviceId: number, userId: number) {
  if (!(await db.isServiceMember(serviceId, userId))) {
    throw new TRPCError({ code: "FORBIDDEN", message: FORBIDDEN_MESSAGE });
  }
}

async function requireServiceChef(serviceId: number, userId: number) {
  if (!(await db.isServiceChef(serviceId, userId))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Action réservée au chef du service" });
  }
}

function requirePermission(medicalRole: string | null | undefined, permission: Permission) {
  if (!canDo(medicalRole as any, permission)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Cette action dépasse vos autorisations dans le service" });
  }
}

async function requireConfirmedServiceRole(serviceId: number, userId: number) {
  const role = await db.getServiceMemberRole(serviceId, userId);
  if (!role || role === "stagiaire") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Un stagiaire peut proposer cette décision, mais pas l'appliquer" });
  }
}

async function requirePatientAccess(patientId: number, userId: number) {
  const patient = await db.getPatientById(patientId);
  if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Patient introuvable" });
  await requireServiceMember(patient.serviceId, userId);
  return patient;
}

async function requirePersonalPatient(personalPatientId: number, userId: number) {
  const patient = await db.getPersonalPatient(personalPatientId, userId);
  if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Patient introuvable" });
  return patient;
}

async function requireVerifiedServiceRole(serviceId: number, userId: number) {
  const membership = await db.getServiceMembership(serviceId, userId);
  if (!membership || membership.role === "stagiaire" || membership.provisional) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Votre accès au Hall est provisoire : proposez cette décision à un membre vérifié pour validation",
    });
  }
}

async function requireMedicalRoleReviewer(serviceId: number, user: { id: number; medicalRole: string | null; medicalRoleVerified: boolean; hospitalId: number | null }) {
  const membership = await db.getServiceMembership(serviceId, user.id);
  if (!membership || !canReviewMedicalRole(user.medicalRole as any, user.medicalRoleVerified, membership.provisional)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "La confirmation d’un rôle nécessite un médecin vérifié ou un résident vérifié non provisoire" });
  }
  const service = await db.getServiceById(serviceId);
  if (!service || !user.hospitalId || user.hospitalId !== service.hospitalId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "La validation doit être réalisée dans le même hôpital" });
  }
  return membership;
}

const hashAccountToken = (token: string) => createHash("sha256").update(token).digest("hex");
const hashInvitationToken = (token: string) => createHash("sha256").update(token).digest("hex");

function publicAppUrl(req: { protocol: string; get(name: string): string | undefined }) {
  return (ENV.publicAppUrl || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

async function sendAccountEmail(to: string, subject: string, text: string) {
  if (!ENV.resendApiKey) {
    if (!ENV.isProduction) console.info(`[PulseBoard email dev] ${to} — ${subject}\n${text}`);
    return false;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: ENV.emailFrom, to: [to], subject, text }),
  });
  if (!response.ok) throw new Error("L'envoi de l'email a échoué");
  return true;
}

async function requireCarnetCapacity(userId: number, serviceName?: string) {
  const subscription = await db.getSubscription(userId);
  if (subscription.plan !== "free") return;
  const usage = await db.getFreePlanUsage(userId);
  if (usage.cases >= 3) throw new TRPCError({ code: "FORBIDDEN", message: "Votre essai gratuit est limité à 3 cas. Passez au Carnet Pro pour continuer." });
  const normalizedService = serviceName?.trim().toLocaleLowerCase("fr-FR");
  if (normalizedService && usage.serviceNames.length > 0 && !usage.serviceNames.includes(normalizedService)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "L'essai gratuit couvre un seul service. Passez au Carnet Pro pour en ajouter un autre." });
  }
}

async function requireRotationCapacity(userId: number) {
  const subscription = await db.getSubscription(userId);
  if (subscription.plan !== "free") return;
  const usage = await db.getFreePlanUsage(userId);
  if (usage.rotations >= 1) throw new TRPCError({ code: "FORBIDDEN", message: "L'essai gratuit couvre une seule rotation. Passez au Carnet Pro pour en ajouter une autre." });
}

async function requireHallPlan(userId: number) {
  if (!ENV.billingEnforced) return;
  const subscription = await db.getSubscription(userId);
  if (subscription.plan !== "hall_carnet") {
    throw new TRPCError({ code: "FORBIDDEN", message: "L'accès à un espace collectif nécessite l'offre Hall + Carnet." });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure.input(z.object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
      password: z.string().min(10).max(128),
      medicalRole: z.enum(["externe", "interne", "resident", "medecin"]).default("interne"),
      acceptTerms: z.literal(true),
      acceptPrivacy: z.literal(true),
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.getUserByEmail(input.email);
      if (existing) throw new Error("Email déjà utilisé");
      const passwordHash = await bcrypt.hash(input.password, 10);
      const openId = nanoid();
      const acceptedAt = new Date();
      await db.upsertUser({ openId, name: input.name, email: input.email, passwordHash, medicalRole: input.medicalRole, loginMethod: "email", termsAcceptedAt: acceptedAt, privacyAcceptedAt: acceptedAt });
      const user = await db.getUserByOpenId(openId);
      if (user) {
        await db.createDefaultSubscription(user.id);
        const verificationToken = nanoid(48);
        await db.createAccountToken(user.id, "email_verification", hashAccountToken(verificationToken), new Date(Date.now() + 24 * 60 * 60 * 1000));
        await sendAccountEmail(input.email, "Confirmez votre adresse PulseBoard", `Confirmez votre adresse dans les 24 heures : ${publicAppUrl(ctx.req)}/verify-email?token=${verificationToken}`).catch(error => console.warn("[PulseBoard] Email de vérification non envoyé:", error.message));
      }
      if (!user) throw new Error("Erreur lors de la création du compte");
      const token = await makeSessionToken(openId, input.name);
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: SESSION_MAX_AGE_MS });
      return { success: true, user };
    }),
    login: publicProcedure.input(z.object({
      email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
      password: z.string().min(1).max(128),
    })).mutation(async ({ ctx, input }) => {
      const user = await db.getUserByEmail(input.email);
      if (!user || !user.passwordHash) {
        await db.logSecurityEvent(null, "login_failed", "Compte introuvable");
        throw new Error("Email ou mot de passe incorrect");
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        await db.logSecurityEvent(user.id, "login_failed", "Mot de passe incorrect");
        throw new Error("Email ou mot de passe incorrect");
      }
      await db.logSecurityEvent(user.id, "login_success");
      const token = await makeSessionToken(user.openId, user.name || "");
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: SESSION_MAX_AGE_MS });
      return { success: true, user };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
    forgotPassword: publicProcedure.input(z.object({ email: z.string().trim().email().max(254).transform(value => value.toLowerCase()) })).mutation(async ({ ctx, input }) => {
      const user = await db.getUserByEmail(input.email);
      if (user?.passwordHash) {
        const rawToken = nanoid(48);
        await db.createAccountToken(user.id, "password_reset", hashAccountToken(rawToken), new Date(Date.now() + 30 * 60 * 1000));
        await sendAccountEmail(input.email, "Réinitialisez votre mot de passe PulseBoard", `Ce lien expire dans 30 minutes : ${publicAppUrl(ctx.req)}/reset-password?token=${rawToken}`).catch(error => console.warn("[PulseBoard] Email de récupération non envoyé:", error.message));
        await db.logSecurityEvent(user.id, "password_reset_requested");
      }
      return { success: true, message: "Si ce compte existe, un lien de récupération a été envoyé." };
    }),
    resetPassword: publicProcedure.input(z.object({ token: z.string().min(32).max(200), password: z.string().min(10).max(128) })).mutation(async ({ input }) => {
      const accountToken = await db.consumeAccountToken(hashAccountToken(input.token), "password_reset");
      if (!accountToken) throw new TRPCError({ code: "BAD_REQUEST", message: "Ce lien est invalide ou a expiré." });
      await db.updatePassword(accountToken.userId, await bcrypt.hash(input.password, 10));
      await db.logSecurityEvent(accountToken.userId, "password_reset_completed");
      return { success: true };
    }),
    verifyEmail: publicProcedure.input(z.object({ token: z.string().min(32).max(200) })).mutation(async ({ input }) => {
      const accountToken = await db.consumeAccountToken(hashAccountToken(input.token), "email_verification");
      if (!accountToken) throw new TRPCError({ code: "BAD_REQUEST", message: "Ce lien est invalide ou a expiré." });
      await db.verifyUserEmail(accountToken.userId);
      await db.logSecurityEvent(accountToken.userId, "email_verified");
      return { success: true };
    }),
  }),

  billing: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const [subscription, usage] = await Promise.all([db.getSubscription(ctx.user.id), db.getFreePlanUsage(ctx.user.id)]);
      return { ...subscription, usage, limits: subscription.plan === "free" ? { cases: 3, services: 1 } : null };
    }),
    requestPayment: protectedProcedure.input(z.object({ plan: z.enum(["carnet_pro", "hall_carnet"]), billingCycle: z.enum(["monthly", "annual"]).default("monthly") })).mutation(async ({ ctx, input }) => {
      const payment = await db.createPaymentRequest(ctx.user.id, input.plan, input.billingCycle, `PB-${Date.now()}-${nanoid(8).toUpperCase()}`);
      return { ...payment, paymentLink: ENV.wavePaymentLink || null, message: ENV.wavePaymentLink ? "Ouvrez Wave puis conservez votre référence de paiement." : "Demande enregistrée. Le paiement Wave sera activé dès que le compte marchand sera configuré." };
    }),
    pendingPayments: adminProcedure.query(() => db.getPendingPayments()),
    confirmPayment: adminProcedure.input(z.object({ paymentId: z.number().int().positive(), providerTransactionId: z.string().trim().min(3).max(200) })).mutation(async ({ ctx, input }) => {
      const result = await db.confirmPayment(input.paymentId, input.providerTransactionId);
      await db.logSecurityEvent(ctx.user.id, "payment_confirmed", `Paiement ${input.paymentId}, utilisateur ${result.userId}, offre ${result.plan}`);
      return result;
    }),
  }),

  account: router({
    exportData: protectedProcedure.mutation(async ({ ctx }) => db.getPersonalDataExport(ctx.user.id)),
    requestDeletion: protectedProcedure.input(z.object({ confirmation: z.literal("SUPPRIMER") })).mutation(async ({ ctx }) => {
      await db.requestAccountDeletion(ctx.user.id);
      await db.logSecurityEvent(ctx.user.id, "account_deletion_requested");
      return { success: true, message: "Votre demande est enregistrée. Le support doit confirmer la suppression après vérification." };
    }),
  }),

  // Dashboard stats
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const services = await db.getServicesByUser(ctx.user.id);
      let totalPatients = 0;
      let totalAlerts = 0;
      for (const service of services) {
        const patients = await db.getPatientsByService(service.id, "tous");
        totalPatients += patients.length;
        const alerts = await db.getAlertsByService(service.id, true);
        totalAlerts += alerts.length;
      }
      return { totalPatients, totalAlerts, totalServices: services.length };
    }),
  }),

  // Hospitals
  hospitals: router({
    list: publicProcedure.query(async () => {
      return db.getHospitals();
    }),
    create: adminProcedure.input(z.object({
      name: z.string().min(2),
      city: z.string().optional(),
    })).mutation(async ({ input }) => {
      return db.createHospital(input.name, input.city || "Sénégal");
    }),
  }),

  // User profile
  profile: router({
    update: protectedProcedure.input(z.object({
      medicalRole: z.enum(["externe", "interne", "resident", "medecin"]).optional(),
      hospitalId: z.number().optional(),
      name: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (input.medicalRole && input.medicalRole !== ctx.user.medicalRole) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Le rôle médical est verrouillé. Utilisez la demande de changement de rôle." });
      }
      const { medicalRole: _medicalRole, ...editableProfile } = input;
      await db.updateUserProfile(ctx.user.id, editableProfile);
      return { success: true };
    }),
    roleStatus: protectedProcedure.query(async ({ ctx }) => ({
      pendingRequest: await db.getPendingMedicalRoleChangeRequest(ctx.user.id),
      history: await db.getMedicalRoleChangeHistory(ctx.user.id),
    })),
    requestRoleChange: protectedProcedure.input(z.object({
      requestedRole: z.enum(["externe", "interne", "resident", "medecin"]),
      reason: z.string().trim().min(10).max(1000),
    })).mutation(async ({ ctx, input }) => {
      if (!ctx.user.medicalRole) throw new TRPCError({ code: "BAD_REQUEST", message: "Votre rôle actuel est introuvable" });
      if (input.requestedRole === ctx.user.medicalRole) throw new TRPCError({ code: "BAD_REQUEST", message: "Choisissez un rôle différent de votre rôle actuel" });
      if (await db.getPendingMedicalRoleChangeRequest(ctx.user.id)) {
        throw new TRPCError({ code: "CONFLICT", message: "Une demande de changement est déjà en attente" });
      }
      const request = await db.createMedicalRoleChangeRequest({
        userId: ctx.user.id,
        currentRole: ctx.user.medicalRole,
        requestedRole: input.requestedRole,
        reason: input.reason,
      });
      await db.logSecurityEvent(ctx.user.id, "medical_role_change_requested", `${ctx.user.medicalRole} → ${input.requestedRole}`);
      return request;
    }),
    cancelRoleChange: protectedProcedure.input(z.object({ requestId: z.number() })).mutation(async ({ ctx, input }) => {
      await db.cancelMedicalRoleChangeRequest(input.requestId, ctx.user.id);
      await db.logSecurityEvent(ctx.user.id, "medical_role_change_canceled", `Demande #${input.requestId}`);
      return { success: true };
    }),
    pendingRoleChanges: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ ctx, input }) => {
      await requireMedicalRoleReviewer(input.serviceId, ctx.user);
      return db.getPendingMedicalRoleChangesForService(input.serviceId);
    }),
    reviewRoleChange: protectedProcedure.input(z.object({
      serviceId: z.number(),
      requestId: z.number(),
      approved: z.boolean(),
      note: z.string().trim().max(1000).optional(),
    })).mutation(async ({ ctx, input }) => {
      await requireMedicalRoleReviewer(input.serviceId, ctx.user);
      const request = await db.getMedicalRoleChangeRequest(input.requestId);
      if (!request || request.status !== "pending") throw new TRPCError({ code: "NOT_FOUND", message: "Demande en attente introuvable" });
      if (request.userId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Vous ne pouvez pas valider votre propre rôle" });
      if (!(await db.isServiceMember(input.serviceId, request.userId))) throw new TRPCError({ code: "FORBIDDEN", message: "Cette personne n’appartient pas à ce Hall" });
      if (request.requestedRole === "medecin" && ctx.user.medicalRole !== "medecin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Le passage au rôle médecin doit être confirmé par un médecin vérifié" });
      }
      if (!input.approved && !input.note?.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Un motif est obligatoire pour refuser la demande" });
      if (await db.getMedicalRoleReview({ targetUserId: request.userId, reviewerId: ctx.user.id, serviceId: input.serviceId, kind: "role_change", requestId: request.id })) {
        throw new TRPCError({ code: "CONFLICT", message: "Vous avez déjà examiné cette demande" });
      }
      await db.createMedicalRoleReview({
        targetUserId: request.userId,
        reviewerId: ctx.user.id,
        serviceId: input.serviceId,
        requestId: request.id,
        kind: "role_change",
        decision: input.approved ? "approved" : "rejected",
        reviewerMedicalRole: ctx.user.medicalRole as "resident" | "medecin",
        note: input.note,
      });
      if (!input.approved) {
        await db.resolveMedicalRoleChange(request.id, ctx.user.id, false, input.note);
        return { status: "rejected", approvals: 0 };
      }
      const reviews = await db.getMedicalRoleReviews(request.userId, input.serviceId, "role_change", request.id);
      const approved = medicalRoleReviewApproved(reviews.filter(review => review.decision === "approved").map(review => review.reviewerMedicalRole));
      if (approved) await db.resolveMedicalRoleChange(request.id, ctx.user.id, true, input.note);
      await db.logActivity({ serviceId: input.serviceId, userId: ctx.user.id, action: approved ? "medical_role_change_approved" : "medical_role_change_reviewed", details: `Demande #${request.id} : ${request.currentRole} → ${request.requestedRole}` });
      return { status: approved ? "approved" : "awaiting_second_review", approvals: reviews.filter(review => review.decision === "approved").length };
    }),
  }),

  // Services
  services: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getServicesByUser(ctx.user.id);
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      await requireServiceMember(input.id, ctx.user.id);
      return db.getServiceById(input.id);
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      specialty: z.string().min(1),
      hospitalId: z.number(),
      totalBeds: z.number().optional(),
      description: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      await requireHallPlan(ctx.user.id);
      requirePermission(ctx.user.medicalRole, "service.create");
      const creatorProvisional = !(ctx.user.medicalRoleVerified && ctx.user.hospitalId === input.hospitalId);
      const { id, code } = await db.createService({ ...input, createdById: ctx.user.id, creatorProvisional });
      await db.logActivity({ serviceId: id, userId: ctx.user.id, action: "service_created", details: `Service "${input.name}" créé` });
      return { id, code };
    }),
    members: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      return db.getServiceMembers(input.serviceId);
    }),
    addMember: protectedProcedure.input(z.object({
      serviceId: z.number(),
      userId: z.number(),
      role: z.enum(["chef", "senior", "junior", "stagiaire"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      await requireServiceChef(input.serviceId, ctx.user.id);
      requirePermission(ctx.user.medicalRole, "service.manage");
      await db.addServiceMember(input.serviceId, input.userId, input.role);
      return { success: true };
    }),
    leave: protectedProcedure.input(z.object({ serviceId: z.number() })).mutation(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      await db.leaveService(input.serviceId, ctx.user.id);
      return { success: true };
    }),
  }),

  // Patients
  patients: router({
    list: protectedProcedure.input(z.object({
      serviceId: z.number(),
      filter: z.enum(["tous", "urgents", "sortie_prevue", "sortis"]).optional(),
    })).query(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      return db.getPatientsByService(input.serviceId, input.filter || "tous");
    }),
    search: protectedProcedure.input(z.object({ query: z.string().trim().min(2).max(100) })).query(async ({ ctx, input }) => {
      const matches = await db.searchPatients(input.query);
      const accessible = await Promise.all(matches.map(async patient =>
        (await db.isServiceMember(patient.serviceId, ctx.user.id)) ? patient : null
      ));
      return accessible.filter((patient): patient is NonNullable<typeof patient> => patient !== null);
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      return requirePatientAccess(input.id, ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      serviceId: z.number(),
      bedNumber: z.number().optional(),
      status: z.enum(["stable", "modere", "critique"]).optional(),
      diagnosis: z.string().optional(),
      allergies: z.string().optional(),
      antecedents: z.string().optional(),
      notes: z.string().optional(),
      dateOfBirth: z.string().optional(),
      gender: z.enum(["M", "F"]).optional(),
      phone: z.string().optional(),
      emergencyContact: z.string().optional(),
      expectedDischarge: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      requirePermission(ctx.user.medicalRole, "patient.admit");
      await requireConfirmedServiceRole(input.serviceId, ctx.user.id);
      const { expectedDischarge, ...rest } = input;
      const id = await db.createPatient({
        ...rest,
        firstName: normalizePatientInitial(rest.firstName),
        lastName: normalizePatientInitial(rest.lastName),
        createdById: ctx.user.id,
        expectedDischarge: expectedDischarge || undefined,
      });
      const displayName = patientInitials(input.firstName, input.lastName);
      await db.logActivity({ serviceId: input.serviceId, patientId: id, userId: ctx.user.id, action: "patient_admitted", details: `${displayName} admis(e)` });
      // Auto-create alerts
      if (!input.bedNumber) {
        await db.createAlert({ serviceId: input.serviceId, patientId: id, type: "no_bed", message: `${displayName} n'a pas de lit assigné` });
      }
      return { id };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      bedNumber: z.number().nullable().optional(),
      status: z.enum(["stable", "modere", "critique"]).optional(),
      diagnosis: z.string().optional(),
      allergies: z.string().optional(),
      antecedents: z.string().optional(),
      notes: z.string().optional(),
      expectedDischarge: z.string().nullable().optional(),
      actualDischarge: z.string().nullable().optional(),
      dpsCompleted: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      const patient = await requirePatientAccess(input.id, ctx.user.id);
      if (input.status !== undefined) requirePermission(ctx.user.medicalRole, "patient.status");
      if (Object.keys(input).some(key => !["id", "status"].includes(key))) requirePermission(ctx.user.medicalRole, "patient.edit");
      await requireConfirmedServiceRole(patient.serviceId, ctx.user.id);
      const { id, expectedDischarge, actualDischarge, ...rest } = input;
      const updateData: any = { ...rest };
      if (rest.firstName !== undefined) updateData.firstName = normalizePatientInitial(rest.firstName);
      if (rest.lastName !== undefined) updateData.lastName = normalizePatientInitial(rest.lastName);
      if (expectedDischarge !== undefined) updateData.expectedDischarge = expectedDischarge || null;
      if (actualDischarge !== undefined) updateData.actualDischarge = actualDischarge || null;
      await db.updatePatient(id, updateData);
      const updatedPatient = await db.getPatientById(id);
      if (updatedPatient) {
        const displayName = patientInitials(updatedPatient.firstName, updatedPatient.lastName);
        await db.logActivity({ serviceId: updatedPatient.serviceId, patientId: id, userId: ctx.user.id, action: "patient_updated", details: `Patient ${displayName} mis à jour` });
        // Create critical alert if status changed to critique
        if (input.status === "critique") {
          await db.createAlert({ serviceId: updatedPatient.serviceId, patientId: id, type: "critical_patient", message: `${displayName} est passé en état critique` });
        }
      }
      return { success: true };
    }),
    assignBed: protectedProcedure.input(z.object({
      id: z.number(),
      bedNumber: z.number().int().positive(),
    })).mutation(async ({ ctx, input }) => {
      const patient = await requirePatientAccess(input.id, ctx.user.id);
      requirePermission(ctx.user.medicalRole, "patient.edit");
      await requireConfirmedServiceRole(patient.serviceId, ctx.user.id);
      if (patient.actualDischarge) {
        throw new TRPCError({ code: "CONFLICT", message: "Impossible d'attribuer un lit à un patient sorti" });
      }

      const service = await db.getServiceById(patient.serviceId);
      if (!service) throw new TRPCError({ code: "NOT_FOUND", message: "Service introuvable" });
      const totalBeds = service.totalBeds ?? 0;
      if (input.bedNumber > totalBeds) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Le service possède seulement ${totalBeds} lits` });
      }

      const activePatients = await db.getPatientsByService(patient.serviceId, "tous");
      const occupant = activePatients.find(other => other.id !== patient.id && other.bedNumber === input.bedNumber);
      if (occupant) {
        throw new TRPCError({ code: "CONFLICT", message: `Le lit ${input.bedNumber} est déjà occupé par ${patientInitials(occupant.firstName, occupant.lastName)}` });
      }

      await db.updatePatient(patient.id, { bedNumber: input.bedNumber });
      await db.resolvePatientAlerts(patient.id, "no_bed", ctx.user.id);
      await db.logActivity({
        serviceId: patient.serviceId,
        patientId: patient.id,
        userId: ctx.user.id,
        action: "bed_assigned",
        details: `Lit ${input.bedNumber} attribué à ${patientInitials(patient.firstName, patient.lastName)}`,
      });
      return { success: true };
    }),
    discharge: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const patient = await requirePatientAccess(input.id, ctx.user.id);
      requirePermission(ctx.user.medicalRole, "patient.discharge");
      await requireConfirmedServiceRole(patient.serviceId, ctx.user.id);
      await requireVerifiedServiceRole(patient.serviceId, ctx.user.id);
      if (patient.actualDischarge) throw new TRPCError({ code: "CONFLICT", message: "Ce patient a déjà quitté le service" });
      await db.updatePatient(input.id, {
        actualDischarge: new Date().toISOString(),
        dischargeDisposition: "sortie",
        referralDestination: null,
        referralReason: null,
        referralDate: null,
      });
      await db.logActivity({ serviceId: patient.serviceId, patientId: input.id, userId: ctx.user.id, action: "patient_discharged", details: `${patientInitials(patient.firstName, patient.lastName)} sorti(e)` });
      return { success: true };
    }),
    refer: protectedProcedure.input(z.object({
      id: z.number(),
      destination: z.string().trim().min(2).max(200),
      reason: z.string().trim().min(2).max(1000),
    })).mutation(async ({ ctx, input }) => {
      const patient = await requirePatientAccess(input.id, ctx.user.id);
      requirePermission(ctx.user.medicalRole, "patient.discharge");
      await requireConfirmedServiceRole(patient.serviceId, ctx.user.id);
      await requireVerifiedServiceRole(patient.serviceId, ctx.user.id);
      if (patient.actualDischarge) throw new TRPCError({ code: "CONFLICT", message: "Ce patient a déjà quitté le service" });
      const referralDate = new Date();
      await db.updatePatient(input.id, {
        actualDischarge: referralDate.toISOString(),
        dischargeDisposition: "refere",
        referralDestination: input.destination,
        referralReason: input.reason,
        referralDate,
      });
      await db.logActivity({
        serviceId: patient.serviceId,
        patientId: input.id,
        userId: ctx.user.id,
        action: "patient_referred",
        details: `${patientInitials(patient.firstName, patient.lastName)} référé(e) vers ${input.destination} — ${input.reason}`,
      });
      return { success: true };
    }),
  }),

  // Tasks
  tasks: router({
    byPatient: protectedProcedure.input(z.object({ patientId: z.number() })).query(async ({ ctx, input }) => {
      await requirePatientAccess(input.patientId, ctx.user.id);
      return db.getTasksByPatient(input.patientId);
    }),
    byService: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      return db.getTasksByService(input.serviceId);
    }),
    create: protectedProcedure.input(z.object({
      patientId: z.number(),
      serviceId: z.number(),
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      dueDate: z.string().optional(),
      assignedToId: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      const patient = await requirePatientAccess(input.patientId, ctx.user.id);
      if (patient.serviceId !== input.serviceId) throw new TRPCError({ code: "BAD_REQUEST", message: "Service incohérent" });
      const { dueDate, ...rest } = input;
      const id = await db.createTask({
        ...rest,
        createdById: ctx.user.id,
        dueDate: dueDate || undefined,
      });
      return { id };
    }),
    updateStatus: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["pending", "in_progress", "completed", "overdue"]),
    })).mutation(async ({ ctx, input }) => {
      const task = await db.getTaskById(input.id);
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Tâche introuvable" });
      await requireServiceMember(task.serviceId, ctx.user.id);
      const data: any = { status: input.status };
      if (input.status === "completed") data.completedAt = new Date().toISOString();
      if (input.status !== "completed") data.completedAt = null;
      await db.updateTask(input.id, data);
      await db.logActivity({
        serviceId: task.serviceId,
        patientId: task.patientId,
        userId: ctx.user.id,
        action: input.status === "completed" ? "task_completed" : input.status === "in_progress" ? "task_started" : "task_reopened",
        details: `Tâche « ${task.title} » ${input.status === "completed" ? "validée" : input.status === "in_progress" ? "commencée" : "rouverte"}`,
      });
      return { success: true };
    }),
  }),

  // Alerts
  alerts: router({
    byService: protectedProcedure.input(z.object({
      serviceId: z.number(),
      onlyActive: z.boolean().optional(),
    })).query(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      return db.getAlertsByService(input.serviceId, input.onlyActive ?? true);
    }),
    resolve: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const alert = await db.getAlertById(input.id);
      if (!alert) throw new TRPCError({ code: "NOT_FOUND", message: "Alerte introuvable" });
      await requireServiceMember(alert.serviceId, ctx.user.id);
      requirePermission(ctx.user.medicalRole, "alert.resolve");
      await db.resolveAlert(input.id, ctx.user.id);
      return { success: true };
    }),
  }),

  // Messages
  messages: router({
    list: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      return db.getMessagesByService(input.serviceId);
    }),
    send: protectedProcedure.input(z.object({
      serviceId: z.number(),
      content: z.string().min(1),
      patientId: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      if (input.patientId) {
        const patient = await requirePatientAccess(input.patientId, ctx.user.id);
        if (patient.serviceId !== input.serviceId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ce patient n'appartient pas à ce service" });
        }
        if (patient.actualDischarge) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ce patient est déjà sorti du service" });
        }
      }
      const id = await db.createMessage({
        serviceId: input.serviceId,
        userId: ctx.user.id,
        content: input.content,
        patientId: input.patientId,
      });
      return { id };
    }),
  }),

  // Activity log
  activity: router({
    byService: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      return db.getActivityByService(input.serviceId);
    }),
  }),

  // Consultations
  consultations: router({
    list: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      return db.getConsultationsByService(input.serviceId);
    }),
    create: protectedProcedure.input(z.object({
      serviceId: z.number(),
      patientFirstName: z.string().min(1),
      patientLastName: z.string().min(1),
      motif: z.string().min(1),
      notes: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      requirePermission(ctx.user.medicalRole, "consult.create");
      const patientFirstName = normalizePatientInitial(input.patientFirstName);
      const patientLastName = normalizePatientInitial(input.patientLastName);
      const id = await db.createConsultation({ ...input, patientFirstName, patientLastName, createdById: ctx.user.id });
      await db.logActivity({ serviceId: input.serviceId, userId: ctx.user.id, action: "consultation_created", details: `Consultation ajoutée : ${patientInitials(patientFirstName, patientLastName)}` });
      return { id };
    }),
    updateStatus: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["en_attente", "vu", "reporte"]),
    })).mutation(async ({ ctx, input }) => {
      const consultation = await db.getConsultationById(input.id);
      if (!consultation) throw new TRPCError({ code: "NOT_FOUND", message: "Consultation introuvable" });
      await requireServiceMember(consultation.serviceId, ctx.user.id);
      await db.updateConsultationStatus(input.id, input.status);
      return { success: true };
    }),
    updateDetails: protectedProcedure.input(z.object({
      id: z.number(),
      rapport: z.string().optional(),
      examensPara: z.string().optional(),
      rendezVous: z.string().optional(),
      status: z.enum(["en_attente", "vu", "reporte"]).optional(),
      serviceId: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      const consultation = await db.getConsultationById(input.id);
      if (!consultation) throw new TRPCError({ code: "NOT_FOUND", message: "Consultation introuvable" });
      await requireServiceMember(consultation.serviceId, ctx.user.id);
      const { id, rendezVous, serviceId, ...rest } = input;
      await db.updateConsultationDetails(id, { ...rest, rendezVous: rendezVous ? new Date(rendezVous) : undefined });
      await db.logActivity({ serviceId: consultation.serviceId, userId: ctx.user.id, action: "consultation_updated", details: "Consultation mise à jour" });
      return { success: true };
    }),
    hospitalize: protectedProcedure.input(z.object({
      id: z.number(),
      bedNumber: z.number().int().positive().optional(),
      status: z.enum(["stable", "modere", "critique"]).default("stable"),
    })).mutation(async ({ ctx, input }) => {
      const consultation = await db.getConsultationById(input.id);
      if (!consultation) throw new TRPCError({ code: "NOT_FOUND", message: "Consultation introuvable" });
      await requireServiceMember(consultation.serviceId, ctx.user.id);
      requirePermission(ctx.user.medicalRole, "patient.admit");
      await requireConfirmedServiceRole(consultation.serviceId, ctx.user.id);
      if (consultation.disposition || consultation.linkedPatientId) {
        throw new TRPCError({ code: "CONFLICT", message: "Une orientation a déjà été enregistrée pour cette consultation" });
      }

      const patientId = await db.createPatient({
        firstName: consultation.patientFirstName,
        lastName: consultation.patientLastName,
        serviceId: consultation.serviceId,
        createdById: ctx.user.id,
        bedNumber: input.bedNumber,
        status: input.status,
        diagnosis: consultation.motif,
        notes: consultation.notes || consultation.rapport || undefined,
      });
      await db.updateConsultationDetails(input.id, {
        disposition: "hospitalise",
        linkedPatientId: patientId,
        status: "vu",
        closedAt: new Date(),
      });
      if (!input.bedNumber) {
        await db.createAlert({
          serviceId: consultation.serviceId,
          patientId,
          type: "no_bed",
          message: `${patientInitials(consultation.patientFirstName, consultation.patientLastName)} n'a pas de lit assigné`,
        });
      }
      await db.logActivity({
        serviceId: consultation.serviceId,
        patientId,
        userId: ctx.user.id,
        action: "consultation_hospitalized",
        details: `${patientInitials(consultation.patientFirstName, consultation.patientLastName)} hospitalisé(e) après consultation`,
      });
      return { patientId };
    }),
    discharge: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const consultation = await db.getConsultationById(input.id);
      if (!consultation) throw new TRPCError({ code: "NOT_FOUND", message: "Consultation introuvable" });
      await requireServiceMember(consultation.serviceId, ctx.user.id);
      requirePermission(ctx.user.medicalRole, "patient.discharge");
      await requireConfirmedServiceRole(consultation.serviceId, ctx.user.id);
      await requireVerifiedServiceRole(consultation.serviceId, ctx.user.id);
      if (consultation.disposition || consultation.linkedPatientId) {
        throw new TRPCError({ code: "CONFLICT", message: "Une orientation a déjà été enregistrée pour cette consultation" });
      }
      await db.updateConsultationDetails(input.id, {
        disposition: "sortie",
        status: "vu",
        closedAt: new Date(),
      });
      await db.logActivity({
        serviceId: consultation.serviceId,
        userId: ctx.user.id,
        action: "consultation_discharged",
        details: `${patientInitials(consultation.patientFirstName, consultation.patientLastName)} sorti(e) après consultation`,
      });
      return { success: true };
    }),
    refer: protectedProcedure.input(z.object({
      id: z.number(),
      destination: z.string().trim().min(2).max(200),
      reason: z.string().trim().min(2).max(1000),
    })).mutation(async ({ ctx, input }) => {
      const consultation = await db.getConsultationById(input.id);
      if (!consultation) throw new TRPCError({ code: "NOT_FOUND", message: "Consultation introuvable" });
      await requireServiceMember(consultation.serviceId, ctx.user.id);
      requirePermission(ctx.user.medicalRole, "patient.discharge");
      await requireConfirmedServiceRole(consultation.serviceId, ctx.user.id);
      await requireVerifiedServiceRole(consultation.serviceId, ctx.user.id);
      if (consultation.disposition || consultation.linkedPatientId) {
        throw new TRPCError({ code: "CONFLICT", message: "Une orientation a déjà été enregistrée pour cette consultation" });
      }
      await db.updateConsultationDetails(input.id, {
        disposition: "refere",
        referralDestination: input.destination,
        referralReason: input.reason,
        status: "vu",
        closedAt: new Date(),
      });
      await db.logActivity({
        serviceId: consultation.serviceId,
        userId: ctx.user.id,
        action: "consultation_referred",
        details: `${patientInitials(consultation.patientFirstName, consultation.patientLastName)} référé(e) vers ${input.destination} — ${input.reason}`,
      });
      return { success: true };
    }),
    history: protectedProcedure.input(z.object({
      serviceId: z.number(),
      firstName: z.string(),
      lastName: z.string(),
    })).query(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      return db.getConsultationHistory(input.serviceId, input.firstName, input.lastName);
    }),
  }),

  // Organisation des gardes, équipes et patients attribués.
  guards: router({
    list: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      return db.getGuardsByService(input.serviceId);
    }),
    create: protectedProcedure.input(z.object({
      serviceId: z.number(), startsAt: z.string(), endsAt: z.string(),
      supervisorId: z.number().optional(), memberIds: z.array(z.number()).optional(),
    })).mutation(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      requirePermission(ctx.user.medicalRole, "guard.manage");
      await requireConfirmedServiceRole(input.serviceId, ctx.user.id);
      const startsAt = new Date(input.startsAt); const endsAt = new Date(input.endsAt);
      if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Les horaires de garde sont invalides" });
      }
      const id = await db.createGuard({ ...input, startsAt, endsAt, createdById: ctx.user.id });
      await db.logActivity({ serviceId: input.serviceId, userId: ctx.user.id, action: "guard_created", details: `Garde prévue du ${startsAt.toLocaleString("fr-FR")} au ${endsAt.toLocaleString("fr-FR")}` });
      return { id };
    }),
    setStatus: protectedProcedure.input(z.object({
      id: z.number(), status: z.enum(["active", "ended"]), summary: z.string().max(4000).optional(),
    })).mutation(async ({ ctx, input }) => {
      const guard = await db.getGuardById(input.id);
      if (!guard) throw new TRPCError({ code: "NOT_FOUND", message: "Garde introuvable" });
      await requireServiceMember(guard.serviceId, ctx.user.id);
      requirePermission(ctx.user.medicalRole, "guard.manage");
      if (input.status === "ended" && !input.summary?.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Un résumé est obligatoire pour terminer la garde" });
      await db.updateGuardStatus(input.id, guard.serviceId, input.status, input.summary);
      return { success: true };
    }),
    addMember: protectedProcedure.input(z.object({
      guardId: z.number(), userId: z.number(), dutyRole: z.enum(["student", "clinician", "supervisor"]),
    })).mutation(async ({ ctx, input }) => {
      const guard = await db.getGuardById(input.guardId);
      if (!guard) throw new TRPCError({ code: "NOT_FOUND", message: "Garde introuvable" });
      await requireServiceMember(guard.serviceId, ctx.user.id);
      requirePermission(ctx.user.medicalRole, "guard.manage");
      await requireServiceMember(guard.serviceId, input.userId);
      await db.addGuardMember(input.guardId, input.userId, input.dutyRole);
      return { success: true };
    }),
    assignPatient: protectedProcedure.input(z.object({
      guardId: z.number(), patientId: z.number(), assignedToId: z.number(), notes: z.string().max(1000).optional(),
    })).mutation(async ({ ctx, input }) => {
      const guard = await db.getGuardById(input.guardId);
      if (!guard) throw new TRPCError({ code: "NOT_FOUND", message: "Garde introuvable" });
      await requireServiceMember(guard.serviceId, ctx.user.id);
      requirePermission(ctx.user.medicalRole, "guard.manage");
      const patient = await requirePatientAccess(input.patientId, ctx.user.id);
      if (patient.serviceId !== guard.serviceId) throw new TRPCError({ code: "BAD_REQUEST", message: "Patient hors de ce service" });
      const id = await db.assignGuardPatient(input.guardId, input.patientId, input.assignedToId, input.notes);
      return { id };
    }),
  }),

  // Décisions préparées par les étudiants/internes et validées par un senior.
  decisionProposals: router({
    list: protectedProcedure.input(z.object({
      serviceId: z.number(),
      pendingOnly: z.boolean().optional(),
    })).query(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      return db.getCareDecisionProposals(input.serviceId, input.pendingOnly ?? true);
    }),
    create: protectedProcedure.input(z.object({
      serviceId: z.number(),
      subjectType: z.enum(["patient", "consultation"]),
      subjectId: z.number(),
      decisionType: z.enum(["sortie", "refere", "hospitalise"]),
      destination: z.string().trim().min(2).max(200).optional(),
      reason: z.string().trim().min(2).max(1000).optional(),
      bedNumber: z.number().int().positive().optional(),
      patientStatus: z.enum(["stable", "modere", "critique"]).optional(),
      urgency: z.enum(["normal", "urgent"]).default("normal"),
      assignedReviewerId: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      requirePermission(ctx.user.medicalRole, "patient.proposeDecision");
      if (input.assignedReviewerId) {
        const reviewerRole = await db.getServiceMemberRole(input.serviceId, input.assignedReviewerId);
        if (!reviewerRole || reviewerRole === "stagiaire") throw new TRPCError({ code: "BAD_REQUEST", message: "Le validateur choisi n'est pas autorisé dans ce service" });
      }
      if (input.decisionType === "refere" && (!input.destination || !input.reason)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La destination et le motif sont obligatoires" });
      }
      if (input.subjectType === "patient") {
        const patient = await requirePatientAccess(input.subjectId, ctx.user.id);
        if (patient.serviceId !== input.serviceId) throw new TRPCError({ code: "BAD_REQUEST", message: "Service incohérent" });
        if (input.decisionType === "hospitalise") throw new TRPCError({ code: "BAD_REQUEST", message: "Ce patient est déjà hospitalisé" });
        if (patient.actualDischarge) throw new TRPCError({ code: "CONFLICT", message: "Ce patient a déjà quitté le service" });
      } else {
        const consultation = await db.getConsultationById(input.subjectId);
        if (!consultation || consultation.serviceId !== input.serviceId) throw new TRPCError({ code: "NOT_FOUND", message: "Consultation introuvable" });
        if (consultation.disposition || consultation.linkedPatientId) throw new TRPCError({ code: "CONFLICT", message: "Une orientation est déjà enregistrée" });
      }
      const id = await db.createCareDecisionProposal({ ...input, proposedById: ctx.user.id });
      await db.logActivity({
        serviceId: input.serviceId,
        patientId: input.subjectType === "patient" ? input.subjectId : undefined,
        userId: ctx.user.id,
        action: "decision_proposed",
        details: `Proposition de ${input.decisionType} en attente de validation`,
      });
      return { id };
    }),
    review: protectedProcedure.input(z.object({
      id: z.number(),
      approved: z.boolean(),
      reviewNote: z.string().trim().max(1000).optional(),
    })).mutation(async ({ ctx, input }) => {
      const proposal = await db.getCareDecisionProposal(input.id);
      if (!proposal) throw new TRPCError({ code: "NOT_FOUND", message: "Proposition introuvable" });
      await requireServiceMember(proposal.serviceId, ctx.user.id);
      requirePermission(ctx.user.medicalRole, "decision.review");
      await requireConfirmedServiceRole(proposal.serviceId, ctx.user.id);
      await requireVerifiedServiceRole(proposal.serviceId, ctx.user.id);
      if (proposal.status !== "pending") throw new TRPCError({ code: "CONFLICT", message: "Cette proposition a déjà été traitée" });
      if (!input.approved && !input.reviewNote?.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Une explication est obligatoire pour refuser la proposition" });
      if (proposal.assignedReviewerId && proposal.assignedReviewerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cette proposition est attribuée à un autre validateur" });
      }

      const claimed = await db.reviewCareDecisionProposal(proposal.id, {
        status: input.approved ? "approved" : "rejected",
        reviewedById: ctx.user.id,
        reviewNote: input.reviewNote,
      });
      if (!claimed) throw new TRPCError({ code: "CONFLICT", message: "Cette proposition vient d'être traitée par un autre membre" });

      try {
        if (input.approved) {
        if (proposal.subjectType === "patient") {
          const patient = await requirePatientAccess(proposal.subjectId, ctx.user.id);
          if (patient.actualDischarge) throw new TRPCError({ code: "CONFLICT", message: "Ce patient a déjà quitté le service" });
          const referralDate = new Date();
          await db.updatePatient(patient.id, proposal.decisionType === "refere" ? {
            actualDischarge: referralDate.toISOString(), dischargeDisposition: "refere",
            referralDestination: proposal.destination, referralReason: proposal.reason, referralDate,
          } : {
            actualDischarge: referralDate.toISOString(), dischargeDisposition: "sortie",
            referralDestination: null, referralReason: null, referralDate: null,
          });
        } else {
          const consultation = await db.getConsultationById(proposal.subjectId);
          if (!consultation || consultation.disposition || consultation.linkedPatientId) {
            throw new TRPCError({ code: "CONFLICT", message: "La consultation a déjà été orientée" });
          }
          if (proposal.decisionType === "hospitalise") {
            const patientId = await db.createPatient({
              firstName: consultation.patientFirstName, lastName: consultation.patientLastName,
              serviceId: consultation.serviceId, createdById: ctx.user.id,
              bedNumber: proposal.bedNumber ?? undefined, status: proposal.patientStatus ?? "stable",
              diagnosis: consultation.motif, notes: consultation.notes || consultation.rapport || undefined,
            });
            await db.updateConsultationDetails(consultation.id, { disposition: "hospitalise", linkedPatientId: patientId, status: "vu", closedAt: new Date() });
            if (!proposal.bedNumber) await db.createAlert({ serviceId: consultation.serviceId, patientId, type: "no_bed", message: `${patientInitials(consultation.patientFirstName, consultation.patientLastName)} n'a pas de lit assigné` });
          } else if (proposal.decisionType === "refere") {
            await db.updateConsultationDetails(consultation.id, {
              disposition: "refere", referralDestination: proposal.destination, referralReason: proposal.reason,
              status: "vu", closedAt: new Date(),
            });
          } else {
            await db.updateConsultationDetails(consultation.id, { disposition: "sortie", status: "vu", closedAt: new Date() });
          }
          }
        }
      } catch (error) {
        await db.resetCareDecisionProposal(proposal.id);
        throw error;
      }
      await db.logActivity({
        serviceId: proposal.serviceId,
        patientId: proposal.subjectType === "patient" ? proposal.subjectId : undefined,
        userId: ctx.user.id,
        action: input.approved ? "decision_approved" : "decision_rejected",
        details: `Proposition de ${proposal.decisionType} ${input.approved ? "validée" : "refusée"}`,
      });
      return { success: true };
    }),
  }),

  // Clinical Notes
  notes: router({
    byPatient: protectedProcedure.input(z.object({ patientId: z.number() })).query(async ({ ctx, input }) => {
      await requirePatientAccess(input.patientId, ctx.user.id);
      return db.getNotesByPatient(input.patientId);
    }),
    create: protectedProcedure.input(z.object({
      patientId: z.number(),
      serviceId: z.number(),
      type: z.enum(["dar", "soap", "libre"]),
      content: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      const patient = await requirePatientAccess(input.patientId, ctx.user.id);
      if (patient.serviceId !== input.serviceId) throw new TRPCError({ code: "BAD_REQUEST", message: "Service incohérent" });
      const id = await db.createClinicalNote({ ...input, createdById: ctx.user.id });
      await db.logActivity({ serviceId: input.serviceId, patientId: input.patientId, userId: ctx.user.id, action: "note_created", details: `Note ${input.type.toUpperCase()} ajoutée` });
      return { id };
    }),
    correct: protectedProcedure.input(z.object({
      noteId: z.number(), content: z.string().trim().min(1), reason: z.string().trim().min(3).max(500),
    })).mutation(async ({ ctx, input }) => {
      const original = await db.getClinicalNoteById(input.noteId);
      if (!original) throw new TRPCError({ code: "NOT_FOUND", message: "Note introuvable" });
      await requirePatientAccess(original.patientId, ctx.user.id);
      requirePermission(ctx.user.medicalRole, "note.create");
      const id = await db.createClinicalNote({
        patientId: original.patientId, serviceId: original.serviceId, type: original.type,
        content: input.content, correctionReason: input.reason, supersedesNoteId: original.id, createdById: ctx.user.id,
      });
      await db.logActivity({ serviceId: original.serviceId, patientId: original.patientId, userId: ctx.user.id, action: "note_corrected", details: `Correction traçable de la note #${original.id} : ${input.reason}` });
      return { id };
    }),
  }),

  // Vital Signs
  vitals: router({
    byPatient: protectedProcedure.input(z.object({ patientId: z.number() })).query(async ({ ctx, input }) => {
      await requirePatientAccess(input.patientId, ctx.user.id);
      return db.getVitalsByPatient(input.patientId);
    }),
    create: protectedProcedure.input(z.object({
      patientId: z.number(),
      serviceId: z.number(),
      temperature: z.string().optional(),
      bloodPressure: z.string().optional(),
      heartRate: z.string().optional(),
      respiratoryRate: z.string().optional(),
      oxygenSaturation: z.string().optional(),
      gcs: z.string().optional(),
      pain: z.string().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const patient = await requirePatientAccess(input.patientId, ctx.user.id);
      if (patient.serviceId !== input.serviceId) throw new TRPCError({ code: "BAD_REQUEST", message: "Service incohérent" });
      const id = await db.createVitalSigns({ ...input, recordedById: ctx.user.id });
      return { id };
    }),
  }),

  // Observations
  observations: router({
    byPatient: protectedProcedure.input(z.object({ patientId: z.number() })).query(async ({ ctx, input }) => {
      await requirePatientAccess(input.patientId, ctx.user.id);
      return db.getObservationsByPatient(input.patientId);
    }),
    create: protectedProcedure.input(z.object({
      patientId: z.number(),
      serviceId: z.number(),
      content: z.string().min(1),
      category: z.enum(["clinique", "infirmier", "evolution", "autre"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      const patient = await requirePatientAccess(input.patientId, ctx.user.id);
      if (patient.serviceId !== input.serviceId) throw new TRPCError({ code: "BAD_REQUEST", message: "Service incohérent" });
      const id = await db.createObservation({ ...input, createdById: ctx.user.id });
      return { id };
    }),
  }),

  // Releve
  releve: router({
    generate: protectedProcedure.input(z.object({ serviceId: z.number() })).mutation(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      // Get all active patients grouped by priority
      const allPatients = await db.getPatientsByService(input.serviceId, "tous");
      const critiques = allPatients.filter(p => p.status === "critique");
      const moderes = allPatients.filter(p => p.status === "modere");
      const stables = allPatients.filter(p => p.status === "stable");

      const formatPatient = (p: any) => {
        const days = Math.max(0, Math.floor((Date.now() - new Date(p.admissionDate).getTime()) / (1000 * 60 * 60 * 24)));
        return `• ${patientInitials(p.firstName, p.lastName)} — Lit ${p.bedNumber || "N/A"} — J+${days} — ${p.diagnosis || "Diagnostic en cours"}`;
      };

      let content = `═══ RELÈVE DU SERVICE ═══\n`;
      content += `Date: ${new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n`;
      content += `Heure: ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}\n\n`;

      if (critiques.length > 0) {
        content += `🔴 CRITIQUES (${critiques.length})\n`;
        critiques.forEach(p => { content += formatPatient(p) + "\n"; });
        content += "\n";
      }
      if (moderes.length > 0) {
        content += `🟠 MODÉRÉS (${moderes.length})\n`;
        moderes.forEach(p => { content += formatPatient(p) + "\n"; });
        content += "\n";
      }
      if (stables.length > 0) {
        content += `🟢 STABLES (${stables.length})\n`;
        stables.forEach(p => { content += formatPatient(p) + "\n"; });
        content += "\n";
      }

      content += `═══ FIN DE RELÈVE ═══\nTotal: ${allPatients.length} patients`;

      const id = await db.createReleve({ serviceId: input.serviceId, generatedById: ctx.user.id, content });
      await db.logActivity({ serviceId: input.serviceId, userId: ctx.user.id, action: "releve_generated", details: "Relève générée" });
      return { id, content };
    }),
    list: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      return db.getRelevesByService(input.serviceId);
    }),
  }),

  // Rotations (carnet de stage)
  rotations: router({
    mine: protectedProcedure.query(async ({ ctx }) => {
      return db.getRotationsByUser(ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      serviceId: z.number(),
      serviceName: z.string().min(1),
      hospitalName: z.string().min(1),
      supervisorName: z.string().optional(),
      startDate: z.string(),
      endDate: z.string().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      // A personal carnet can contain a rotation that is not attached to a
      // collective PulseBoard service. In that case the UI sends the sentinel
      // service id 0 and no service membership is required.
      if (input.serviceId > 0) await requireServiceMember(input.serviceId, ctx.user.id);
      await requireRotationCapacity(ctx.user.id);
      return db.createRotation({ ...input, userId: ctx.user.id });
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      endDate: z.string().optional(),
      supervisorName: z.string().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      return db.updateRotation(ctx.user.id, input);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      return db.deleteRotation(input.id, ctx.user.id);
    }),
  }),

  // Compétences (carnet de stage)
  competences: router({
    mine: protectedProcedure.query(async ({ ctx }) => {
      return db.getCompetencesByUser(ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      title: z.string().min(1),
      category: z.enum(["geste_technique", "diagnostic", "therapeutique", "communication", "autre"]),
      rotationId: z.number().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      return db.createCompetence({ ...input, userId: ctx.user.id });
    }),
    validate: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const competence = await db.getCompetenceById(input.id);
      if (!competence) throw new TRPCError({ code: "NOT_FOUND", message: "Compétence introuvable" });
      if (!competence.rotationId) throw new TRPCError({ code: "FORBIDDEN", message: "Cette compétence n'est liée à aucune rotation" });
      const rotation = await db.getRotationById(competence.rotationId);
      if (!rotation) throw new TRPCError({ code: "NOT_FOUND", message: "Rotation introuvable" });
      await requireServiceChef(rotation.serviceId, ctx.user.id);
      return db.validateCompetence(input.id, ctx.user.id);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      return db.deleteCompetence(input.id, ctx.user.id);
    }),
  }),

  // Stats personnelles
  personal: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      return db.getPersonalStats(ctx.user.id);
    }),
    myNotes: protectedProcedure.query(async ({ ctx }) => {
      return db.getNotesByUser(ctx.user.id);
    }),
    myTasks: protectedProcedure.query(async ({ ctx }) => {
      return db.getTasksByUser(ctx.user.id);
    }),
  }),

  // Système de codes de service
  membership: router({
    join: protectedProcedure.input(z.object({
      code: z.string().min(4).optional(),
      invitationToken: z.string().min(20).optional(),
    }).refine(value => Boolean(value.code || value.invitationToken), { message: "Code ou invitation obligatoire" })).mutation(async ({ ctx, input }) => {
      await requireHallPlan(ctx.user.id);
      if (input.invitationToken) {
        const invitation = await db.getServiceInvitation(hashInvitationToken(input.invitationToken));
        if (!invitation || invitation.revokedAt || invitation.expiresAt <= new Date() || invitation.usedCount >= invitation.maxUses) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cette invitation est invalide, expirée ou a atteint sa limite" });
        }
        const service = await db.getServiceById(invitation.serviceId);
        if (!service) throw new TRPCError({ code: "NOT_FOUND", message: "Service introuvable" });
        const canJoinImmediately = canJoinImmediatelyWithInvitation(ctx.user.medicalRole);
        const provisional = !(ctx.user.medicalRoleVerified && ctx.user.hospitalId === service.hospitalId);
        const result = await db.joinService(service.id, ctx.user.id, {
          autoApprove: canJoinImmediately,
          medicalRole: ctx.user.medicalRole,
          provisional,
        });
        if (result.status === "joined") await db.recordServiceInvitationUse(invitation.id, invitation.usedCount);
        return result;
      }
      const service = await db.getServiceByCode(input.code!);
      if (!service) throw new TRPCError({ code: "BAD_REQUEST", message: "Code invalide" });
      const autoJoin = canAutoJoinService(
        ctx.user.medicalRole,
        ctx.user.medicalRoleVerified,
        ctx.user.hospitalId,
        service.hospitalId,
      );
      return db.joinService(service.id, ctx.user.id, {
        autoApprove: autoJoin,
        medicalRole: ctx.user.medicalRole,
      });
    }),
    createInvitation: protectedProcedure.input(z.object({ serviceId: z.number() })).mutation(async ({ ctx, input }) => {
      await requireServiceChef(input.serviceId, ctx.user.id);
      const token = nanoid(32);
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      await db.createServiceInvitation({
        serviceId: input.serviceId,
        tokenHash: hashInvitationToken(token),
        createdById: ctx.user.id,
        expiresAt,
        maxUses: 20,
      });
      await db.logActivity({ serviceId: input.serviceId, userId: ctx.user.id, action: "service_invitation_created", details: "Invitation sécurisée valable 72 heures" });
      return { token, expiresAt, maxUses: 20 };
    }),
    provisionalMembers: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ ctx, input }) => {
      await requireMedicalRoleReviewer(input.serviceId, ctx.user);
      return db.getProvisionalMedicalRoleMembers(input.serviceId);
    }),
    verifyMedicalRole: protectedProcedure.input(z.object({
      serviceId: z.number(),
      targetUserId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      await requireMedicalRoleReviewer(input.serviceId, ctx.user);
      if (input.targetUserId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Vous ne pouvez pas confirmer votre propre rôle" });
      const targetMembership = await db.getServiceMembership(input.serviceId, input.targetUserId);
      const targetUser = await db.getUserById(input.targetUserId);
      const service = await db.getServiceById(input.serviceId);
      if (!targetMembership || !targetMembership.provisional || !targetUser || !service) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Membre provisoire introuvable" });
      }
      if (!targetUser.hospitalId || targetUser.hospitalId !== service.hospitalId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "L’établissement déclaré ne correspond pas à celui du Hall" });
      }
      if (targetUser.medicalRole === "medecin" && ctx.user.medicalRole !== "medecin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Le rôle médecin doit être confirmé par un autre médecin vérifié" });
      }
      if (await db.getMedicalRoleReview({ targetUserId: input.targetUserId, reviewerId: ctx.user.id, serviceId: input.serviceId, kind: "initial_verification" })) {
        throw new TRPCError({ code: "CONFLICT", message: "Vous avez déjà confirmé ce rôle" });
      }
      await db.createMedicalRoleReview({
        targetUserId: input.targetUserId,
        reviewerId: ctx.user.id,
        serviceId: input.serviceId,
        kind: "initial_verification",
        decision: "approved",
        reviewerMedicalRole: ctx.user.medicalRole as "resident" | "medecin",
      });
      const reviews = await db.getMedicalRoleReviews(input.targetUserId, input.serviceId, "initial_verification");
      const verified = medicalRoleReviewApproved(reviews.map(review => review.reviewerMedicalRole));
      if (verified) await db.confirmMedicalRole(input.targetUserId, ctx.user.id, input.serviceId);
      await db.logActivity({ serviceId: input.serviceId, userId: ctx.user.id, action: verified ? "medical_role_verified" : "medical_role_reviewed", details: `${targetUser.name || `Utilisateur #${targetUser.id}`} · ${targetUser.medicalRole}` });
      return { status: verified ? "verified" : "awaiting_second_review", approvals: reviews.length };
    }),
    pendingRequests: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ ctx, input }) => {
      await requireServiceChef(input.serviceId, ctx.user.id);
      return db.getPendingRequests(input.serviceId);
    }),
    resolve: protectedProcedure.input(z.object({ requestId: z.number(), approved: z.boolean() })).mutation(async ({ ctx, input }) => {
      const request = await db.getJoinRequestById(input.requestId);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Demande introuvable" });
      await requireServiceChef(request.serviceId, ctx.user.id);
      return db.resolveJoinRequest(input.requestId, input.approved, ctx.user.id, false);
    }),
    isChef: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ ctx, input }) => {
      const members = await db.getServiceMembers(input.serviceId);
      return members.some((m: any) => m.userId === ctx.user.id && m.role === "chef");
    }),
    myRole: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      return db.getServiceMemberRole(input.serviceId, ctx.user.id);
    }),
    myMembership: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      return db.getServiceMembership(input.serviceId, ctx.user.id);
    }),
  }),

  procedures: router({
    mine: protectedProcedure.query(async ({ ctx }) => db.getProceduresByUser(ctx.user.id)),
    create: protectedProcedure.input(z.object({
      title: z.string().trim().min(2).max(200), rotationId: z.number().optional(), personalPatientId: z.number().optional(),
      performedAt: z.string().optional(), participationLevel: z.enum(["observed", "assisted", "supervised", "autonomous"]),
      outcome: z.enum(["success", "partial", "failed"]).optional(), attempts: z.number().int().min(1).max(20).optional(),
      reflection: z.string().max(2000).optional(),
    })).mutation(async ({ ctx, input }) => {
      if (input.personalPatientId) await requirePersonalPatient(input.personalPatientId, ctx.user.id);
      if (input.rotationId) {
        const rotation = await db.getRotationById(input.rotationId);
        if (!rotation || rotation.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Rotation inaccessible" });
      }
      return db.createProcedure({ ...input, userId: ctx.user.id, performedAt: input.performedAt ? new Date(input.performedAt) : undefined });
    }),
    validate: protectedProcedure.input(z.object({ id: z.number(), comment: z.string().max(1000).optional() })).mutation(async ({ ctx, input }) => {
      const procedure = await db.getProcedureById(input.id);
      if (!procedure) throw new TRPCError({ code: "NOT_FOUND", message: "Geste introuvable" });
      if (!procedure.rotationId) throw new TRPCError({ code: "BAD_REQUEST", message: "Ce geste n'est lié à aucune rotation" });
      const rotation = await db.getRotationById(procedure.rotationId);
      if (!rotation) throw new TRPCError({ code: "NOT_FOUND", message: "Rotation introuvable" });
      await requireServiceChef(rotation.serviceId, ctx.user.id);
      await db.validateProcedure(input.id, ctx.user.id, input.comment);
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      return db.deleteProcedure(input.id, ctx.user.id);
    }),
  }),

  // Patients personnels (cahier de stage)
  personalPatients: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getPersonalPatients(ctx.user.id);
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      return db.getPersonalPatient(input.id, ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      dateOfBirth: z.string().optional(),
      gender: z.enum(["M", "F"]).default("M"),
      phone: z.string().optional(),
      status: z.enum(["stable", "modere", "critique"]).default("stable"),
      diagnosis: z.string().optional(),
      allergies: z.string().optional(),
      antecedents: z.string().optional(),
      serviceName: z.string().optional(),
      bedNumber: z.number().optional(),
      encounterType: z.enum(["consultation", "hospitalisation"]).default("hospitalisation"),
    })).mutation(async ({ ctx, input }) => {
      await requireCarnetCapacity(ctx.user.id, input.serviceName);
      return db.createPersonalPatient({ ...input, userId: ctx.user.id });
    }),
    importFromCollective: protectedProcedure.input(z.object({
      patientId: z.number(), encounterType: z.enum(["consultation", "hospitalisation"]).default("hospitalisation"),
    })).mutation(async ({ ctx, input }) => {
      const patient = await requirePatientAccess(input.patientId, ctx.user.id);
      const existingId = await db.personalPatientExistsForSource(ctx.user.id, patient.id);
      if (existingId) return { id: existingId, alreadyExists: true };
      const service = await db.getServiceById(patient.serviceId);
      await requireCarnetCapacity(ctx.user.id, service?.name);
      const firstInitial = patient.firstName.trim().charAt(0).toUpperCase();
      const lastInitial = patient.lastName.trim().charAt(0).toUpperCase();
      const anonymousCode = `${firstInitial}.${lastInitial}.-${String(patient.id).padStart(3, "0")}`;
      const id = await db.createPersonalPatient({
        userId: ctx.user.id, firstName: firstInitial, lastName: lastInitial,
        gender: patient.gender || "M", status: patient.status, diagnosis: patient.diagnosis || undefined,
        serviceName: service?.name, encounterType: input.encounterType, anonymousCode, sourcePatientId: patient.id,
      });
      return { id, alreadyExists: false };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["stable", "modere", "critique"]).optional(),
      diagnosis: z.string().optional(),
      discharged: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      await requirePersonalPatient(input.id, ctx.user.id);
      return db.updatePersonalPatient(input.id, ctx.user.id, input);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await requirePersonalPatient(input.id, ctx.user.id);
      return db.deletePersonalPatient(input.id, ctx.user.id);
    }),
    // Notes
    notes: protectedProcedure.input(z.object({ personalPatientId: z.number() })).query(async ({ ctx, input }) => {
      return db.getPersonalNotes(input.personalPatientId, ctx.user.id);
    }),
    addNote: protectedProcedure.input(z.object({
      personalPatientId: z.number(),
      type: z.enum(["dar", "soap", "libre"]).default("dar"),
      content: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      await requirePersonalPatient(input.personalPatientId, ctx.user.id);
      return db.createPersonalNote({ ...input, userId: ctx.user.id });
    }),
    deleteNote: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      return db.deletePersonalNote(input.id, ctx.user.id);
    }),
    // Tâches
    tasks: protectedProcedure.input(z.object({ personalPatientId: z.number() })).query(async ({ ctx, input }) => {
      return db.getPersonalTasks(input.personalPatientId, ctx.user.id);
    }),
    addTask: protectedProcedure.input(z.object({
      personalPatientId: z.number(),
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    })).mutation(async ({ ctx, input }) => {
      await requirePersonalPatient(input.personalPatientId, ctx.user.id);
      return db.createPersonalTask({ ...input, userId: ctx.user.id });
    }),
    completeTask: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      return db.completePersonalTask(input.id, ctx.user.id);
    }),
    deleteTask: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      return db.deletePersonalTask(input.id, ctx.user.id);
    }),
    // Vitaux
    vitals: protectedProcedure.input(z.object({ personalPatientId: z.number() })).query(async ({ ctx, input }) => {
      return db.getPersonalVitals(input.personalPatientId, ctx.user.id);
    }),
    addVitals: protectedProcedure.input(z.object({
      personalPatientId: z.number(),
      temperature: z.string().optional(),
      bloodPressure: z.string().optional(),
      heartRate: z.string().optional(),
      respiratoryRate: z.string().optional(),
      oxygenSaturation: z.string().optional(),
      gcs: z.string().optional(),
      pain: z.string().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      await requirePersonalPatient(input.personalPatientId, ctx.user.id);
      return db.createPersonalVitals({ ...input, userId: ctx.user.id });
    }),
    // Observations
    observations: protectedProcedure.input(z.object({ personalPatientId: z.number() })).query(async ({ ctx, input }) => {
      return db.getPersonalObservations(input.personalPatientId, ctx.user.id);
    }),
    addObservation: protectedProcedure.input(z.object({
      personalPatientId: z.number(),
      content: z.string().min(1),
      category: z.enum(["clinique", "infirmier", "evolution", "autre"]).default("clinique"),
    })).mutation(async ({ ctx, input }) => {
      await requirePersonalPatient(input.personalPatientId, ctx.user.id);
      return db.createPersonalObservation({ ...input, userId: ctx.user.id });
    }),
  }),
});

export type AppRouter = typeof appRouter;
