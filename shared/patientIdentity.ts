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

export function isPatientInitial(value: string): boolean {
  return /^[A-Za-zÀ-ÖØ-öø-ÿ]$/u.test(value.trim());
}

export function patientGivenNameAbbreviation(value: string | null | undefined): string {
  const letters = value?.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "").slice(0, 2) ?? "";
  if (!letters) return "X.";
  const abbreviated = `${letters.charAt(0).toLocaleUpperCase("fr-FR")}${letters.slice(1).toLocaleLowerCase("fr-FR")}`;
  return `${abbreviated}.`;
}

export function isPatientGivenNamePrefix(value: string): boolean {
  return /^[A-Za-zÀ-ÖØ-öø-ÿ]{2}$/u.test(value.trim());
}
