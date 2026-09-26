type RightsSummary = {
  published: boolean;
  commercial_use: string[];
  modification: string[];
  raw_data_redistribution: string[];
  citation: string[];
};

export function isEditorialRightsEligible(rights: RightsSummary | undefined): boolean {
  return Boolean(
    rights?.published &&
    rights.commercial_use.length === 1 &&
    rights.commercial_use[0] === "Allowed" &&
    rights.modification.length === 1 &&
    rights.modification[0] === "Allowed" &&
    rights.raw_data_redistribution.length === 1 &&
    rights.raw_data_redistribution[0] === "Allowed" &&
    rights.citation.length === 1 &&
    rights.citation[0] === "Required",
  );
}
