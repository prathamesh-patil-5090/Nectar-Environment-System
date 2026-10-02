export type CompetitionAbsence = {
  id: string;
  employeeId: string;
  employeeName: string;
  siteId: string;
  date: string;
  shiftId: string;
  requiredSkills: string[];
  status: string;
};

export type CompetitionReliever = {
  id: string;
  employeeId?: string;
  name: string;
  homeSiteId?: string;
  skills: string[];
  plantTypes: string[];
  availability: string;
  assignedSiteId?: string;
  assignedAbsenceId?: string;
};

type CompetitionSources = {
  getAbsences: () => CompetitionAbsence[];
  getRelievers: () => CompetitionReliever[];
};

let sources: CompetitionSources | null = null;

export function registerCompetitionSources(api: CompetitionSources) {
  sources = api;
}

export function getCompetitionSources(): CompetitionSources {
  if (!sources) {
    return {
      getAbsences: () => [],
      getRelievers: () => [],
    };
  }
  return sources;
}
