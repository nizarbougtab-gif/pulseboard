export type MedicalRole = "externe" | "interne" | "resident" | "medecin";

export type Permission =
  | "note.create"
  | "task.create" | "task.complete" | "task.delete"
  | "vitals.create"
  | "patient.admit" | "patient.discharge" | "patient.edit" | "patient.status"
  | "patient.proposeDecision" | "decision.review"
  | "alert.resolve"
  | "service.create" | "service.manage"
  | "guard.manage"
  | "releve.generate" | "releve.view"
  | "consult.create" | "consult.close";

const common: Permission[] = [
  "note.create", "task.create", "task.complete", "vitals.create",
  "patient.proposeDecision", "releve.view", "consult.create",
];

const clinical: Permission[] = [
  ...common, "task.delete", "patient.admit", "patient.edit",
  "patient.status", "alert.resolve", "releve.generate", "consult.close",
];

const PERMISSIONS: Record<MedicalRole, Permission[]> = {
  externe: common,
  interne: [...clinical, "service.create"],
  resident: [...clinical, "patient.discharge", "decision.review", "guard.manage", "service.create"],
  medecin: [...clinical, "patient.discharge", "decision.review", "guard.manage", "service.create", "service.manage"],
};

export function canDo(role: MedicalRole | null | undefined, permission: Permission): boolean {
  return role ? PERMISSIONS[role]?.includes(permission) ?? false : false;
}

export function canAutoJoinService(
  role: MedicalRole | null | undefined,
  roleVerified: boolean,
  userHospitalId: number | null | undefined,
  serviceHospitalId: number,
): boolean {
  return Boolean(
    roleVerified && role && role !== "externe" &&
    userHospitalId && userHospitalId === serviceHospitalId,
  );
}

export const ROLE_LABELS: Record<MedicalRole, string> = {
  externe: "Étudiant / Externe",
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
