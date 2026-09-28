export type PlantType = "ETP" | "STP" | "WTP" | "RO" | "MEE";

export type Site = {
  id: string;
  name: string;
  plantType: PlantType;
  location: string;
  headcount: number;
  readiness: number;
};
