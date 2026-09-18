export const siteIdentity = {
  businessName: "SeitenHafen361",
  operatorName: "Schayan Yousefian",
  legalForm: "Einzelunternehmen",
  street: "Freienwalder Str. 34",
  postalCode: "13359",
  city: "Berlin",
  country: "Deutschland",
} as const;

export const siteBrand = {
  name: "Cite Supply",
  mark: "CS",
  tagline: "Publisher-ready data, charts, and tools.",
  discoveryLine: "Where publishers find data.",
} as const;

// The domain mailbox will be added before the legal pages are considered launch-ready.
export const publicContactEmail: string | null = null;
