// Suchparameter aus der Adresse als Text (Zahlen wie «48» bleiben Text, damit Links sauber bleiben).
export const searchString = (value: unknown): string | undefined =>
  typeof value === "string" || typeof value === "number" ? String(value) : undefined;
