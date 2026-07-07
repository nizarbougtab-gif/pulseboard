import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { ENV } from "./_core/env";
import { nanoid } from "nanoid";

const SESSION_COOKIE = "pb_session";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function makeSessionToken(openId: string, name: string) {
  const secret = new TextEncoder().encode(ENV.cookieSecret || "pulseboard-secret-key-change-in-prod");
  return new SignJWT({ openId, name })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("365d")
    .sign(secret);
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure.input(z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(6),
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
      ctx.res.cookie(SESSION_COOKIE, token, { httpOnly: true, maxAge: ONE_YEAR_MS, sameSite: "lax" });
      return { success: true, user };
    }),
    login: publicProcedure.input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      const user = await db.getUserByEmail(input.email);
      if (!user || !user.passwordHash) throw new Error("Email ou mot de passe incorrect");
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) throw new Error("Email ou mot de passe incorrect");
      const token = await makeSessionToken(user.openId, user.name || "");
      ctx.res.cookie(SESSION_COOKIE, token, { httpOnly: true, maxAge: ONE_YEAR_MS, sameSite: "lax" });
      return { success: true, user };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(SESSION_COOKIE, { sameSite: "lax" });
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
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getServiceById(input.id);
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      specialty: z.string().min(1),
      hospitalId: z.number(),
      totalBeds: z.number().optional(),
      description: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.createService({ ...input, createdById: ctx.user.id });
      await db.logActivity({ serviceId: id, userId: ctx.user.id, action: "service_created", details: `Service "${input.name}" créé` });
      return { id };
    }),
    members: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ input }) => {
      return db.getServiceMembers(input.serviceId);
    }),
    addMember: protectedProcedure.input(z.object({
      serviceId: z.number(),
      userId: z.number(),
      role: z.enum(["chef", "senior", "junior", "stagiaire"]).optional(),
    })).mutation(async ({ input }) => {
      await db.addServiceMember(input.serviceId, input.userId, input.role);
      return { success: true };
    }),
  }),

  // Patients
  patients: router({
    list: protectedProcedure.input(z.object({
      serviceId: z.number(),
      filter: z.enum(["tous", "urgents", "sortie_prevue", "sortis"]).optional(),
    })).query(async ({ input }) => {
      return db.getPatientsByService(input.serviceId, input.filter || "tous");
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getPatientById(input.id);
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
      const { expectedDischarge, ...rest } = input;
      const id = await db.createPatient({
        ...rest,
        createdById: ctx.user.id,
        expectedDischarge: expectedDischarge ? new Date(expectedDischarge) : undefined,
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
      const { id, expectedDischarge, actualDischarge, ...rest } = input;
      const updateData: any = { ...rest };
      if (expectedDischarge !== undefined) updateData.expectedDischarge = expectedDischarge ? new Date(expectedDischarge) : null;
      if (actualDischarge !== undefined) updateData.actualDischarge = actualDischarge ? new Date(actualDischarge) : null;
      await db.updatePatient(id, updateData);
      const patient = await db.getPatientById(id);
      if (patient) {
        await db.logActivity({ serviceId: patient.serviceId, patientId: id, userId: ctx.user.id, action: "patient_updated", details: `Patient ${patient.firstName} ${patient.lastName} mis à jour` });
        // Create critical alert if status changed to critique
        if (input.status === "critique") {
          await db.createAlert({ serviceId: patient.serviceId, patientId: id, type: "critical_patient", message: `${patient.firstName} ${patient.lastName} est passé en état critique` });
        }
      }
      return { success: true };
    }),
    discharge: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await db.updatePatient(input.id, { actualDischarge: new Date() });
      const patient = await db.getPatientById(input.id);
      if (patient) {
        await db.logActivity({ serviceId: patient.serviceId, patientId: input.id, userId: ctx.user.id, action: "patient_discharged", details: `${patient.firstName} ${patient.lastName} sorti(e)` });
      }
      return { success: true };
    }),
  }),

  // Tasks
  tasks: router({
    byPatient: protectedProcedure.input(z.object({ patientId: z.number() })).query(async ({ input }) => {
      return db.getTasksByPatient(input.patientId);
    }),
    byService: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ input }) => {
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
      const { dueDate, ...rest } = input;
      const id = await db.createTask({
        ...rest,
        createdById: ctx.user.id,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      });
      return { id };
    }),
    updateStatus: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["pending", "in_progress", "completed", "overdue"]),
    })).mutation(async ({ input }) => {
      const data: any = { status: input.status };
      if (input.status === "completed") data.completedAt = new Date();
      await db.updateTask(input.id, data);
      return { success: true };
    }),
  }),

  // Alerts
  alerts: router({
    byService: protectedProcedure.input(z.object({
      serviceId: z.number(),
      onlyActive: z.boolean().optional(),
    })).query(async ({ input }) => {
      return db.getAlertsByService(input.serviceId, input.onlyActive ?? true);
    }),
    resolve: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      await db.resolveAlert(input.id, ctx.user.id);
      return { success: true };
    }),
  }),

  // Messages
  messages: router({
    list: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ input }) => {
      return db.getMessagesByService(input.serviceId);
    }),
    send: protectedProcedure.input(z.object({
      serviceId: z.number(),
      content: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.createMessage({ serviceId: input.serviceId, userId: ctx.user.id, content: input.content });
      return { id };
    }),
  }),

  // Activity log
  activity: router({
    byService: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ input }) => {
      return db.getActivityByService(input.serviceId);
    }),
  }),

  // Consultations
  consultations: router({
    list: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ input }) => {
      return db.getConsultationsByService(input.serviceId);
    }),
    create: protectedProcedure.input(z.object({
      serviceId: z.number(),
      patientFirstName: z.string().min(1),
      patientLastName: z.string().min(1),
      motif: z.string().min(1),
      notes: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.createConsultation({ ...input, createdById: ctx.user.id });
      await db.logActivity({ serviceId: input.serviceId, userId: ctx.user.id, action: "consultation_created", details: `Consultation ajoutée: ${input.patientFirstName} ${input.patientLastName}` });
      return { id };
    }),
    updateStatus: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["en_attente", "vu", "reporte"]),
    })).mutation(async ({ input }) => {
      await db.updateConsultationStatus(input.id, input.status);
      return { success: true };
    }),
  }),

  // Clinical Notes
  notes: router({
    byPatient: protectedProcedure.input(z.object({ patientId: z.number() })).query(async ({ input }) => {
      return db.getNotesByPatient(input.patientId);
    }),
    create: protectedProcedure.input(z.object({
      patientId: z.number(),
      serviceId: z.number(),
      type: z.enum(["dar", "soap", "libre"]),
      content: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.createClinicalNote({ ...input, createdById: ctx.user.id });
      await db.logActivity({ serviceId: input.serviceId, patientId: input.patientId, userId: ctx.user.id, action: "note_created", details: `Note ${input.type.toUpperCase()} ajoutée` });
      return { id };
    }),
  }),

  // Vital Signs
  vitals: router({
    byPatient: protectedProcedure.input(z.object({ patientId: z.number() })).query(async ({ input }) => {
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
      const id = await db.createVitalSigns({ ...input, recordedById: ctx.user.id });
      return { id };
    }),
  }),

  // Observations
  observations: router({
    byPatient: protectedProcedure.input(z.object({ patientId: z.number() })).query(async ({ input }) => {
      return db.getObservationsByPatient(input.patientId);
    }),
    create: protectedProcedure.input(z.object({
      patientId: z.number(),
      serviceId: z.number(),
      content: z.string().min(1),
      category: z.enum(["clinique", "infirmier", "evolution", "autre"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.createObservation({ ...input, createdById: ctx.user.id });
      return { id };
    }),
  }),

  // Releve
  releve: router({
    generate: protectedProcedure.input(z.object({ serviceId: z.number() })).mutation(async ({ ctx, input }) => {
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
    list: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ input }) => {
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
      return db.createRotation({ ...input, userId: ctx.user.id });
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      endDate: z.string().optional(),
      supervisorName: z.string().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => {
      return db.updateRotation(input);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      return db.deleteRotation(input.id);
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
      return db.validateCompetence(input.id, ctx.user.id);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      return db.deleteCompetence(input.id);
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
});

export type AppRouter = typeof appRouter;
