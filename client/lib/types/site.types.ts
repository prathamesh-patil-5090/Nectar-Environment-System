export type PlantType = "ETP" | "STP" | "WTP" | "RO" | "MEE";

export type SiteStatus = "operational" | "new" | "upcoming" | "closed";

export type Site = {
  id: string;
  name: string;
  plantType: PlantType;
  location: string;
  headcount: number;
  readiness: number;
  /** Every treatment process the plant runs; `plantType` is the primary one. */
  plantTypes?: PlantType[];
  status?: SiteStatus;
};
