export { canDo, ROLE_COLORS, ROLE_LABELS } from "../../../shared/permissions";
export type { MedicalRole, Permission } from "../../../shared/permissions";

import type { MedicalRole } from "../../../shared/permissions";

const RANK: Record<MedicalRole, number> = {
  externe: 0,
  interne: 1,
  resident: 2,
  medecin: 3,
};

export function isAtLeast(role: MedicalRole | null | undefined, minimum: MedicalRole): boolean {
  return (RANK[role as MedicalRole] ?? -1) >= RANK[minimum];
}
