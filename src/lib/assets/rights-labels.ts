export type RightsValue = boolean | null | undefined;

export function permissionLabel(value: RightsValue): string {
  if (value === true) return "Allowed";
  if (value === false) return "Not allowed";
  return "Unknown";
}

export function obligationLabel(value: RightsValue): string {
  if (value === true) return "Required";
  if (value === false) return "Not required";
  return "Unknown";
}

export function rightsValueState(value: RightsValue): "allowed" | "not-allowed" | "unknown" {
  if (value === true) return "allowed";
  if (value === false) return "not-allowed";
  return "unknown";
}
