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

const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const FORBIDDEN_MESSAGE = "Vous n'avez pas accès à cette ressource";

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

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure.input(z.object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
      password: z.string().min(10).max(128),
      medicalRole: z.enum(["externe", "interne", "resident", "medecin"]).default("interne"),
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.getUserByEmail(input.email);
      if (existing) throw new Error("Email déjà utilisé");
      const passwordHash = await bcrypt.hash(input.password, 10);
      const openId = nanoid();
      await db.upsertUser({ openId, name: input.name, email: input.email, passwordHash, medicalRole: input.medicalRole, loginMethod: "email" });
      const user = await db.getUserByOpenId(openId);
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
      if (!user || !user.passwordHash) throw new Error("Email ou mot de passe incorrect");
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) throw new Error("Email ou mot de passe incorrect");
      const token = await makeSessionToken(user.openId, user.name || "");
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: SESSION_MAX_AGE_MS });
      return { success: true, user };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
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
      await db.updateUserProfile(ctx.user.id, input);
      return { success: true };
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
      const { id, code } = await db.createService({ ...input, createdById: ctx.user.id });
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
      const { expectedDischarge, ...rest } = input;
      const id = await db.createPatient({
        ...rest,
        createdById: ctx.user.id,
        expectedDischarge: expectedDischarge || undefined,
      });
      await db.logActivity({ serviceId: input.serviceId, patientId: id, userId: ctx.user.id, action: "patient_admitted", details: `${input.firstName} ${input.lastName} admis(e)` });
      // Auto-create alerts
      if (!input.bedNumber) {
        await db.createAlert({ serviceId: input.serviceId, patientId: id, type: "no_bed", message: `${input.firstName} ${input.lastName} n'a pas de lit assigné` });
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
      const { id, expectedDischarge, actualDischarge, ...rest } = input;
      const updateData: any = { ...rest };
      if (expectedDischarge !== undefined) updateData.expectedDischarge = expectedDischarge || null;
      if (actualDischarge !== undefined) updateData.actualDischarge = actualDischarge || null;
      await db.updatePatient(id, updateData);
      const updatedPatient = await db.getPatientById(id);
      if (updatedPatient) {
        await db.logActivity({ serviceId: updatedPatient.serviceId, patientId: id, userId: ctx.user.id, action: "patient_updated", details: `Patient ${updatedPatient.firstName} ${updatedPatient.lastName} mis à jour` });
        // Create critical alert if status changed to critique
        if (input.status === "critique") {
          await db.createAlert({ serviceId: updatedPatient.serviceId, patientId: id, type: "critical_patient", message: `${updatedPatient.firstName} ${updatedPatient.lastName} est passé en état critique` });
        }
      }
      return { success: true };
    }),
    discharge: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const patient = await requirePatientAccess(input.id, ctx.user.id);
      if (patient.actualDischarge) throw new TRPCError({ code: "CONFLICT", message: "Ce patient a déjà quitté le service" });
      await db.updatePatient(input.id, {
        actualDischarge: new Date().toISOString(),
        dischargeDisposition: "sortie",
        referralDestination: null,
        referralReason: null,
        referralDate: null,
      });
      await db.logActivity({ serviceId: patient.serviceId, patientId: input.id, userId: ctx.user.id, action: "patient_discharged", details: `${patient.firstName} ${patient.lastName} sorti(e)` });
      return { success: true };
    }),
    refer: protectedProcedure.input(z.object({
      id: z.number(),
      destination: z.string().trim().min(2).max(200),
      reason: z.string().trim().min(2).max(1000),
    })).mutation(async ({ ctx, input }) => {
      const patient = await requirePatientAccess(input.id, ctx.user.id);
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
        details: `${patient.firstName} ${patient.lastName} référé(e) vers ${input.destination} — ${input.reason}`,
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
      await db.updateTask(input.id, data);
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
    })).mutation(async ({ ctx, input }) => {
      await requireServiceMember(input.serviceId, ctx.user.id);
      const id = await db.createMessage({ serviceId: input.serviceId, userId: ctx.user.id, content: input.content });
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
      const id = await db.createConsultation({ ...input, createdById: ctx.user.id });
      await db.logActivity({ serviceId: input.serviceId, userId: ctx.user.id, action: "consultation_created", details: `Consultation ajoutée: ${input.patientFirstName} ${input.patientLastName}` });
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
          message: `${consultation.patientFirstName} ${consultation.patientLastName} n'a pas de lit assigné`,
        });
      }
      await db.logActivity({
        serviceId: consultation.serviceId,
        patientId,
        userId: ctx.user.id,
        action: "consultation_hospitalized",
        details: `${consultation.patientFirstName} ${consultation.patientLastName} hospitalisé(e) après consultation`,
      });
      return { patientId };
    }),
    discharge: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const consultation = await db.getConsultationById(input.id);
      if (!consultation) throw new TRPCError({ code: "NOT_FOUND", message: "Consultation introuvable" });
      await requireServiceMember(consultation.serviceId, ctx.user.id);
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
        details: `${consultation.patientFirstName} ${consultation.patientLastName} sorti(e) après consultation`,
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
        details: `${consultation.patientFirstName} ${consultation.patientLastName} référé(e) vers ${input.destination} — ${input.reason}`,
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
        const days = Math.floor((Date.now() - new Date(p.admissionDate).getTime()) / (1000 * 60 * 60 * 24));
        return `• ${p.firstName} ${p.lastName} — Lit ${p.bedNumber || "N/A"} — J+${days} — ${p.diagnosis || "Diagnostic en cours"}`;
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
      await requireServiceMember(input.serviceId, ctx.user.id);
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
    join: protectedProcedure.input(z.object({ code: z.string().min(4) })).mutation(async ({ ctx, input }) => {
      const service = await db.getServiceByCode(input.code);
      if (!service) throw new Error("Code invalide");
      return db.joinService(service.id, ctx.user.id);
    }),
    pendingRequests: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ ctx, input }) => {
      await requireServiceChef(input.serviceId, ctx.user.id);
      return db.getPendingRequests(input.serviceId);
    }),
    resolve: protectedProcedure.input(z.object({ requestId: z.number(), approved: z.boolean() })).mutation(async ({ ctx, input }) => {
      const request = await db.getJoinRequestById(input.requestId);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Demande introuvable" });
      await requireServiceChef(request.serviceId, ctx.user.id);
      return db.resolveJoinRequest(input.requestId, input.approved, ctx.user.id);
    }),
    isChef: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ ctx, input }) => {
      const members = await db.getServiceMembers(input.serviceId);
      return members.some((m: any) => m.userId === ctx.user.id && m.role === "chef");
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
    })).mutation(async ({ ctx, input }) => {
      return db.createPersonalPatient({ ...input, userId: ctx.user.id });
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
