export type MedicalRole = "externe" | "interne" | "resident" | "medecin";

// Hierarchy: externe < interne < resident < medecin
const RANK: Record<MedicalRole, number> = {
  externe: 0,
  interne: 1,
  resident: 2,
  medecin: 3,
};

function rank(role: MedicalRole | null | undefined): number {
  return RANK[role as MedicalRole] ?? -1;
}

export type Permission =
  // Notes
  | "note.create"        // Écrire une note clinique
  | "note.delete"        // Supprimer une note (ses propres notes seulement pour interne/résident)
  // Tâches
  | "task.create"        // Créer une tâche
  | "task.complete"      // Marquer une tâche comme terminée
  | "task.delete"        // Supprimer une tâche
  // Constantes vitales
  | "vitals.create"      // Enregistrer des constantes
  // Patient
  | "patient.admit"      // Admettre un nouveau patient
  | "patient.discharge"  // Sortir un patient
  | "patient.edit"       // Modifier les infos du patient (diag, DPS…)
  | "patient.status"     // Changer le statut (critique/stable)
  // Service
  | "service.create"     // Créer un service
  | "service.manage"     // Gérer les membres du service
  // Relève
  | "releve.generate"    // Générer la relève officielle
  | "releve.view"        // Voir la relève
  // Consultation
  | "consult.create"     // Créer une consultation
  | "consult.close";     // Clôturer une consultation

const PERMISSIONS: Record<MedicalRole, Permission[]> = {
  externe: [
    "note.create",
    "task.create",
    "task.complete",
    "vitals.create",
    "service.create",
    "releve.view",
    "consult.create",
  ],
  interne: [
    "note.create",
    "note.delete",
    "task.create",
    "task.complete",
    "task.delete",
    "vitals.create",
    "patient.admit",
    "patient.edit",
    "patient.status",
    "service.create",
    "releve.view",
    "releve.generate",
    "consult.create",
    "consult.close",
  ],
  resident: [
    "note.create",
    "note.delete",
    "task.create",
    "task.complete",
    "task.delete",
    "vitals.create",
    "patient.admit",
    "patient.discharge",
    "patient.edit",
    "patient.status",
    "service.create",
    "releve.view",
    "releve.generate",
    "consult.create",
    "consult.close",
  ],
  medecin: [
    "note.create",
    "note.delete",
    "task.create",
    "task.complete",
    "task.delete",
    "vitals.create",
    "patient.admit",
    "patient.discharge",
    "patient.edit",
    "patient.status",
    "service.create",
    "service.manage",
    "releve.view",
    "releve.generate",
    "consult.create",
    "consult.close",
  ],
};

export function canDo(role: MedicalRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

export function isAtLeast(role: MedicalRole | null | undefined, minimum: MedicalRole): boolean {
  return rank(role) >= RANK[minimum];
}

export const ROLE_LABELS: Record<MedicalRole, string> = {
  externe: "Externe",
  interne: "Interne",
  resident: "Résident",
  medecin: "Médecin",
};

export const ROLE_COLORS: Record<MedicalRole, string> = {
  externe: "bg-gray-100 text-gray-600",
  interne: "bg-blue-100 text-blue-700",
  resident: "bg-purple-100 text-purple-700",
  medecin: "bg-[var(--pulseboard-green-light)] text-[var(--pulseboard-green)]",
};
