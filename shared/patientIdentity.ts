export function patientInitial(value: string | null | undefined): string {
  return value?.trim().charAt(0).toUpperCase() ?? "";
}

export function patientInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  return [patientInitial(firstName), patientInitial(lastName)]
    .filter(Boolean)
    .map(initial => `${initial}.`)
    .join(" ");
}

export function patientInitialsCompact(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  return `${patientInitial(firstName)}${patientInitial(lastName)}` || "P";
}

export function sanitizePatientInitial(value: string): string {
  return patientInitial(value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, ""));
}
