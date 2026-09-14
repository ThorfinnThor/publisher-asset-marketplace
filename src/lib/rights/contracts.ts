export type TriState = true | false | null;

export type RightsStatus = "safe" | "restricted" | "unknown" | "blocked";

export type AssetRights = {
  embed_allowed: TriState;
  commercial_use: TriState;
  modification_allowed: TriState;
  citation_required: TriState;
  raw_data_redistribution: TriState;
  share_alike: TriState;
  attribution_required: TriState;
  evidence_url: string | null;
  evidence_checked_at: string | null;
};

export const unknownRights: AssetRights = {
  embed_allowed: null,
  commercial_use: null,
  modification_allowed: null,
  citation_required: null,
  raw_data_redistribution: null,
  share_alike: null,
  attribution_required: null,
  evidence_url: null,
  evidence_checked_at: null,
};
