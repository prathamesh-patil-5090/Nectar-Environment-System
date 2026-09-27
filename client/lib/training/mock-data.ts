import type {
  Course,
  JobCategory,
  CompetencyArea,
  CourseEnrollment,
  PracticalTestResult,
  OralTestResult,
  SkillMappingResult,
  WrittenTestResult,
  Certificate,
  LearningNeedRecord,
  TrainingSession,
  MentorProfile,
  CourseRecommendation,
  RoleProgressionTrack,
  SpecializationTrack,
} from "./types";

export const mockJobCategories: JobCategory[] = [
  {
    id: "jc-etp-op",
    name: "ETP & Wastewater Specialist",
    description: "Operates primary physico-chemical, ASP, MBBR, and MBR industrial wastewater treatment units.",
  },
  {
    id: "jc-stp-op",
    name: "STP Operations Specialist",
    description: "Operates Sequencing Batch Reactors (SBR), MBBR bio-carriers, and skid-mounted packaged sewage plants.",
  },
  {
    id: "jc-wtp-tech",
    name: "WTP & Membrane Specialist",
    description: "Responsible for industrial Reverse Osmosis (RO), Ultrafiltration (UF), and high-purity EDI water generation.",
  },
  {
    id: "jc-zld-eng",
    name: "ZLD Thermal Systems Operator",
    description: "Operates Multiple Effect Evaporators (MEE), Agitated Thin Film Dryers (ATFD), and salt crystallization systems.",
  },
  {
    id: "jc-env-consultant",
    name: "Environmental Audit & Treatability Analyst",
    description: "Conducts industrial water audits, laboratory treatability studies, and statutory CTE/CTO environmental filings.",
  },
  {
    id: "jc-onm-lead",
    name: "O&M Service & Maintenance Lead",
    description: "Manages deputed site manpower, monthly Water Quality & Quantity (WQ&Q) reporting, and preventive maintenance.",
  },
];

export const mockCompetencyAreas: CompetencyArea[] = [
  { id: "ca-etp-bio", jobCategoryId: "jc-etp-op", name: "Biological Aeration & MBR Filtration", weightPct: 30 },
  { id: "ca-etp-chem", jobCategoryId: "jc-etp-op", name: "Physico-Chemical Coagulation & Sludge Press", weightPct: 25 },
  { id: "ca-stp-sbr", jobCategoryId: "jc-stp-op", name: "SBR Cyclic Timers & MBBR Hydrodynamics", weightPct: 30 },
  { id: "ca-stp-skid", jobCategoryId: "jc-stp-op", name: "Skid-Mounted Packaged STP Maintenance", weightPct: 25 },
  { id: "ca-wtp-ro", jobCategoryId: "jc-wtp-tech", name: "RO Desalination & High-Pressure Booster Hydraulics", weightPct: 30 },
  { id: "ca-wtp-uf", jobCategoryId: "jc-wtp-tech", name: "Ultrafiltration Hollow-Fiber & EDI Demineralization", weightPct: 25 },
  { id: "ca-zld-mee", jobCategoryId: "jc-zld-eng", name: "Multiple Effect Evaporation & Steam Economy", weightPct: 30 },
  { id: "ca-zld-atfd", jobCategoryId: "jc-zld-eng", name: "ATFD Salt Crystallization & Dry Cake Discharge", weightPct: 25 },
  { id: "ca-env-audit", jobCategoryId: "jc-env-consultant", name: "Water Balance Auditing & CTE/CTO Consent Norms", weightPct: 30 },
  { id: "ca-env-treat", jobCategoryId: "jc-env-consultant", name: "Bench Treatability Studies & Jar Testing", weightPct: 25 },
  { id: "ca-onm-report", jobCategoryId: "jc-onm-lead", name: "Monthly WQ&Q Dossiers & Logsheet Validation", weightPct: 30 },
  { id: "ca-onm-pm", jobCategoryId: "jc-onm-lead", name: "Preventive Maintenance & Site Safety Isolation", weightPct: 25 },
];

export const mockCourses: Course[] = [
  // ==========================================
  // 1. EFFLUENT TREATMENT PLANTS (ETP)
  // ==========================================
  {
    id: "course-etp-101",
    title: "ETP Biological & Chemical Treatment Operations",
    code: "ETP-101",
    section: "Effluent Treatment Plants (ETP)",
    jobCategoryId: "jc-etp-op",
    description:
      "Comprehensive industrial effluent operations: equalization air sparging, coagulant jar testing, primary settling, aerobic biological flocs, and clarifier sludge recycling.",
    thumbnailUrl: "/courses/etp_plant.jpg",
    estimatedHours: 4.5,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-1-1",
        courseId: "course-etp-101",
        order: 1,
        code: "1.1",
        title: "Process Flow & Design Hydraulic Retention Time (HRT)",
        description: "Understanding plant inlet screening, equalization tank buffer volume, and peak flow shock load absorption.",
        videoDurationMinutes: 1,
        competencyAreaId: "ca-etp-bio",
        readingContent:
          "Design HRT must be maintained at a minimum of 8.5 hours in the equalization basin to handle batch chemical discharges from pharmaceutical client lines. Operators must monitor level transmitters and maintain equalizing air spargers at 1.2 kg/cm² to prevent anaerobic septic odors.",
        microQuiz: {
          id: "mq-1-1",
          abilityId: "ab-1-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-1-1-1",
              text: "What is the primary function of the Equalization Basin in an industrial ETP?",
              options: [
                { id: "opt-a", text: "Buffer hydraulic peak flows and dampen pH/COD shock variations" },
                { id: "opt-b", text: "Direct biological nutrient removal via anaerobic digestion" },
                { id: "opt-c", text: "Precipitate heavy metals via high-rate gravity settling" },
                { id: "opt-d", text: "Provide tertiary polishing prior to RO membrane feed" },
              ],
              correctOptionId: "opt-a",
              explanation: "Equalization tanks normalize hydraulic peaks and homogenize chemical concentrations before biological stages.",
            },
            {
              id: "q-1-1-2",
              text: "If influent peak flow surges 40% above equalization capacity during a process rinse, what is the protocol?",
              options: [
                { id: "opt-a", text: "Engage the emergency equalization lagoon and adjust feed pump VFDs to maintain steady downstream loading" },
                { id: "opt-b", text: "Bypass raw wastewater straight into the final treated discharge channel" },
                { id: "opt-c", text: "Shut down equalization air blowers immediately to promote anaerobic settling" },
                { id: "opt-d", text: "Pour concentrated sulfuric acid into the wet well" },
              ],
              correctOptionId: "opt-a",
              explanation: "Emergency equalization ponds receive hydraulic surges while forward feed VFDs deliver steady, non-shock flows to aeration.",
            },
            {
              id: "q-1-1-3",
              text: "What minimum air pressure must be delivered by the equalization spargers to prevent anaerobic septic odors?",
              options: [
                { id: "opt-a", text: "1.0 to 1.4 kg/cm² continuous aeration" },
                { id: "opt-b", text: "0.0 kg/cm² (air sparging should be turned off)" },
                { id: "opt-c", text: "12.0 to 16.0 kg/cm² extreme high-pressure air" },
                { id: "opt-d", text: "Negative vacuum suction" },
              ],
              correctOptionId: "opt-a",
              explanation: "Air spargers operating at ~1.2 kg/cm² maintain solids suspension and prevent anaerobic septic decomposition in equalization.",
            },
          ],
        },
      },
      {
        id: "ab-1-2",
        courseId: "course-etp-101",
        order: 2,
        code: "1.2",
        title: "Chemical Coagulation, Flocculation & Jar Testing",
        description: "Executing standard jar test dosing with Alum, PAC, lime, and polyelectrolytes for primary settling.",
        videoDurationMinutes: 2,
        competencyAreaId: "ca-etp-chem",
        readingContent:
          "Coagulation destabilizes colloidal charges at rapid mixing (100 RPM, 60s). Flocculation facilitates bridge formation between microflocs at slow agitation (30 RPM, 15 min). Optimum pH for Alum is 6.5–7.5, and for PAC is 6.0–8.5.",
        microQuiz: {
          id: "mq-1-2",
          abilityId: "ab-1-2",
          passThreshold: 70,
          questions: [
            {
              id: "q-1-2-1",
              text: "What is the consequence of severe PAC overdosing in the primary clarifier?",
              options: [
                { id: "opt-a", text: "Formation of pin-point flocs and charge reversal, worsening turbidity" },
                { id: "opt-b", text: "Extremely dense sludge that jams the scrapper" },
                { id: "opt-c", text: "Instant reduction of total dissolved solids" },
                { id: "opt-d", text: "Sterilization of all bacteria" },
              ],
              correctOptionId: "opt-a",
              explanation: "Overdosing neutralizes and then reverses particle surface charges, preventing floc agglomeration.",
            },
            {
              id: "q-1-2-2",
              text: "What is the standard jar test rapid mix protocol to ensure colloidal charge destabilization?",
              options: [
                { id: "opt-a", text: "100–120 RPM rapid mixing for 60 seconds" },
                { id: "opt-b", text: "10 RPM slow mixing for 30 minutes" },
                { id: "opt-c", text: "No agitation — static incubation for 2 hours" },
                { id: "opt-d", text: "500 RPM for 15 minutes" },
              ],
              correctOptionId: "opt-a",
              explanation: "Flash mixing requires high shear (100–120 RPM) for 60 seconds to uniformly distribute coagulant cations across colloidal surfaces.",
            },
            {
              id: "q-1-2-3",
              text: "Which chemical is dosed alongside Alum when raw effluent alkalinity is too low to maintain pH 6.5–7.5?",
              options: [
                { id: "opt-a", text: "Hydrated Lime (Ca(OH)2) or Caustic Soda (NaOH)" },
                { id: "opt-b", text: "Concentrated Hydrochloric Acid (HCl)" },
                { id: "opt-c", text: "Ferrous Sulfate" },
                { id: "opt-d", text: "Citric acid solution" },
              ],
              correctOptionId: "opt-a",
              explanation: "Alum hydrolysis consumes natural alkalinity; lime or caustic soda buffers the reaction within optimal coagulation pH.",
            },
            {
              id: "q-1-2-4",
              text: "What role does an anionic or cationic polyelectrolyte play during the slow-mix flocculation phase?",
              options: [
                { id: "opt-a", text: "Forms polymer bridges between destabilized microflocs to create heavy, rapidly settling macroflocs" },
                { id: "opt-b", text: "Lowers chemical oxygen demand through biological synthesis" },
                { id: "opt-c", text: "Replaces secondary biological aeration completely" },
                { id: "opt-d", text: "Sterilizes coliform pathogens" },
              ],
              correctOptionId: "opt-a",
              explanation: "Long-chain polyelectrolyte polymers bridge microflocs together into robust, fast-settling flocs.",
            },
            {
              id: "q-1-2-5",
              text: "When analyzing results across a 6-beaker Jar Test gradient, which beaker dosage is deemed optimal?",
              options: [
                { id: "opt-a", text: "The lowest chemical dose that produces < 15 NTU supernatant clarity and settles within 10 minutes" },
                { id: "opt-b", text: "The highest dosage beaker regardless of chemical cost or carryover" },
                { id: "opt-c", text: "The beaker producing the largest total volume of wet sludge" },
                { id: "opt-d", text: "The beaker with the lowest pH regardless of floc formation" },
              ],
              correctOptionId: "opt-a",
              explanation: "Optimal dosing balances effluent clarity compliance with chemical consumption stoichiometry.",
            },
          ],
        },
      },
      {
        id: "ab-1-3",
        courseId: "course-etp-101",
        order: 3,
        code: "1.3",
        title: "Aeration Basin DO & Mixed Liquor Suspended Solids (MLSS)",
        description: "Maintaining active biomass health, dissolved oxygen between 2.0-3.0 mg/L, and Food-to-Microorganism (F/M) balance.",
        videoDurationMinutes: 1,
        competencyAreaId: "ca-etp-bio",
        readingContent:
          "Target MLSS for extended aeration is 3000 to 4500 mg/L with DO maintained strictly between 2.0 and 2.5 ppm. If DO drops below 1.5 ppm, filamentous bacteria proliferate, causing severe sludge bulking.",
        microQuiz: {
          id: "mq-1-3",
          abilityId: "ab-1-3",
          passThreshold: 70,
          questions: [
            {
              id: "q-1-3-1",
              text: "What is the recommended Dissolved Oxygen (DO) setpoint in an active aerobic tank?",
              options: [
                { id: "opt-a", text: "2.0 to 3.0 mg/L" },
                { id: "opt-b", text: "0.2 to 0.5 mg/L" },
                { id: "opt-c", text: "8.0 to 12.0 mg/L" },
                { id: "opt-d", text: "15.0 to 20.0 mg/L" },
              ],
              correctOptionId: "opt-a",
              explanation: "2.0–3.0 mg/L ensures aerobic respiration without wasted blower power.",
            },
            {
              id: "q-1-3-2",
              text: "What operational pathology occurs if aeration basin DO remains chronically below 1.5 mg/L?",
              options: [
                { id: "opt-a", text: "Filamentous bacteria overgrow, causing sludge bulking and poor clarifier compaction" },
                { id: "opt-b", text: "Nitrification rate accelerates dramatically" },
                { id: "opt-c", text: "Sludge settles instantly like coarse sand" },
                { id: "opt-d", text: "Aeration blowers automatically double their RPM" },
              ],
              correctOptionId: "opt-a",
              explanation: "Low DO conditions allow filamentous bacteria to out-compete floc-forming organisms, leading to high SVI and billowy sludge blankets.",
            },
            {
              id: "q-1-3-3",
              text: "If laboratory MLSS analysis reports 1,900 mg/L against a design target of 3,500 mg/L, what action should the operator take?",
              options: [
                { id: "opt-a", text: "Increase Return Activated Sludge (RAS) recycling and decrease Waste Activated Sludge (WAS) wasting" },
                { id: "opt-b", text: "Double the daily WAS sludge wasting rate to purge the system" },
                { id: "opt-c", text: "Shut off all blower aeration to stop microbial breathing" },
                { id: "opt-d", text: "Flush the aeration basin with chlorinated municipal tap water" },
              ],
              correctOptionId: "opt-a",
              explanation: "Reducing waste sludge (WAS) and maximizing RAS builds active microbial inventory back to target MLSS levels.",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-1-1",
        text: "During a chemical shock load where influent COD surges to 6,500 mg/L, what is the immediate operator action?",
        options: [
          { id: "opt-a", text: "Increase equalization retention, throttle feed to aeration, and increase return sludge (RAS)" },
          { id: "opt-b", text: "Shut down aeration blowers to save electricity" },
          { id: "opt-c", text: "Dump raw wastewater into the secondary clarifier" },
          { id: "opt-d", text: "Turn off all chemical dosing pumps" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-1",
        text: "Main role of site incharge?",
        options: [
          { id: "opt-a", text: "Operate plant" },
          { id: "opt-b", text: "Supervise plant" },
          { id: "opt-c", text: "Clean plant" },
          { id: "opt-d", text: "Ignore issues" },
        ],
        correctOptionId: "opt-b",
      },
      {
        id: "wtq-2",
        text: "RO removes mainly?",
        options: [
          { id: "opt-a", text: "Bacteria" },
          { id: "opt-b", text: "Dissolved salts" },
          { id: "opt-c", text: "Sand" },
          { id: "opt-d", text: "Oil" },
        ],
        correctOptionId: "opt-b",
      },
      {
        id: "wtq-3",
        text: "Unit of TDS?",
        options: [
          { id: "opt-a", text: "ppm" },
          { id: "opt-b", text: "kg" },
          { id: "opt-c", text: "m3" },
          { id: "opt-d", text: "bar" },
        ],
        correctOptionId: "opt-a",
      },
      {
        id: "wtq-4",
        text: "SDI stands for?",
        options: [
          { id: "opt-a", text: "Silt Density Index" },
          { id: "opt-b", text: "Salt Density Index" },
          { id: "opt-c", text: "System Design Index" },
          { id: "opt-d", text: "None" },
        ],
        correctOptionId: "opt-a",
      },
      {
        id: "wtq-5",
        text: "High pressure pump is used for?",
        options: [
          { id: "opt-a", text: "Mixing" },
          { id: "opt-b", text: "Filtration / Membrane pressure" },
          { id: "opt-c", text: "Membrane pressure" },
          { id: "opt-d", text: "Cooling" },
        ],
        correctOptionId: "opt-b",
      },
      {
        id: "wtq-6",
        text: "Antiscalant prevents?",
        options: [
          { id: "opt-a", text: "Scaling" },
          { id: "opt-b", text: "Corrosion" },
          { id: "opt-c", text: "Foaming" },
          { id: "opt-d", text: "Rust" },
        ],
        correctOptionId: "opt-a",
      },
      {
        id: "wtq-7",
        text: "SMBS is used for?",
        options: [
          { id: "opt-a", text: "Chlorine removal" },
          { id: "opt-b", text: "pH increase" },
          { id: "opt-c", text: "Scaling" },
          { id: "opt-d", text: "Cleaning" },
        ],
        correctOptionId: "opt-a",
      },
      {
        id: "wtq-8",
        text: "RO permeate is?",
        options: [
          { id: "opt-a", text: "Waste water" },
          { id: "opt-b", text: "Treated water" },
          { id: "opt-c", text: "Sludge" },
          { id: "opt-d", text: "Chemical" },
        ],
        correctOptionId: "opt-b",
      },
      {
        id: "wtq-9",
        text: "Normal RO pressure?",
        options: [
          { id: "opt-a", text: "1-2 bar" },
          { id: "opt-b", text: "5-10 bar / 10-20 bar" },
          { id: "opt-c", text: "10-20 bar" },
          { id: "opt-d", text: "50 bar" },
        ],
        correctOptionId: "opt-b",
      },
      {
        id: "wtq-10",
        text: "Biofouling means?",
        options: [
          { id: "opt-a", text: "Salt deposition" },
          { id: "opt-b", text: "Bacteria growth" },
          { id: "opt-c", text: "Scaling" },
          { id: "opt-d", text: "Leakage" },
        ],
        correctOptionId: "opt-b",
      },
      {
        id: "wtq-11",
        text: "Membrane damage due to?",
        options: [
          { id: "opt-a", text: "Low pressure" },
          { id: "opt-b", text: "High chlorine" },
          { id: "opt-c", text: "Low flow" },
          { id: "opt-d", text: "Low TDS" },
        ],
        correctOptionId: "opt-b",
      },
      {
        id: "wtq-12",
        text: "CIP means?",
        options: [
          { id: "opt-a", text: "Clean in place" },
          { id: "opt-b", text: "Control in pipe" },
          { id: "opt-c", text: "Check in plant" },
          { id: "opt-d", text: "None" },
        ],
        correctOptionId: "opt-a",
      },
      {
        id: "wtq-13",
        text: "Cartridge filter removes?",
        options: [
          { id: "opt-a", text: "Dissolved salts" },
          { id: "opt-b", text: "Suspended solids" },
          { id: "opt-c", text: "Chemicals" },
          { id: "opt-d", text: "Gas" },
        ],
        correctOptionId: "opt-b",
      },
      {
        id: "wtq-14",
        text: "pH range for RO?",
        options: [
          { id: "opt-a", text: "2-3" },
          { id: "opt-b", text: "6-8" },
          { id: "opt-c", text: "10-12" },
          { id: "opt-d", text: "14" },
        ],
        correctOptionId: "opt-b",
      },
      {
        id: "wtq-15",
        text: "Recovery means?",
        options: [
          { id: "opt-a", text: "Water loss" },
          { id: "opt-b", text: "Water produced" },
          { id: "opt-c", text: "Water reused" },
          { id: "opt-d", text: "Pressure loss" },
        ],
        correctOptionId: "opt-b",
      },
      {
        id: "wtq-16",
        text: "Backwash used in?",
        options: [
          { id: "opt-a", text: "RO" },
          { id: "opt-b", text: "UF" },
          { id: "opt-c", text: "Pump" },
          { id: "opt-d", text: "Tank" },
        ],
        correctOptionId: "opt-b",
      },
      {
        id: "wtq-17",
        text: "High TDS cause?",
        options: [
          { id: "opt-a", text: "Leakage" },
          { id: "opt-b", text: "Membrane damage" },
          { id: "opt-c", text: "Low pressure" },
          { id: "opt-d", text: "Cooling" },
        ],
        correctOptionId: "opt-b",
      },
      {
        id: "wtq-18",
        text: "Low flow reason?",
        options: [
          { id: "opt-a", text: "Clogging" },
          { id: "opt-b", text: "High pressure" },
          { id: "opt-c", text: "Low TDS" },
          { id: "opt-d", text: "Good condition" },
        ],
        correctOptionId: "opt-a",
      },
      {
        id: "wtq-19",
        text: "RO reject is?",
        options: [
          { id: "opt-a", text: "Pure water" },
          { id: "opt-b", text: "Waste stream" },
          { id: "opt-c", text: "Air" },
          { id: "opt-d", text: "Chemical" },
        ],
        correctOptionId: "opt-b",
      },
      {
        id: "wtq-20",
        text: "Safety responsibility of incharge?",
        options: [
          { id: "opt-a", text: "Ignore" },
          { id: "opt-b", text: "Follow & enforce" },
          { id: "opt-c", text: "Delegate only" },
          { id: "opt-d", text: "None" },
        ],
        correctOptionId: "opt-b",
      },
    ],
  },
  {
    id: "course-etp-102",
    title: "Advanced Membrane Bio-Reactor (MBR) for Industrial Effluents",
    code: "ETP-102",
    section: "Effluent Treatment Plants (ETP)",
    jobCategoryId: "jc-etp-op",
    description:
      "Submerged flat-sheet and hollow-fiber MBR cassettes, MLSS operation (8,000–12,000 mg/L), continuous coarse bubble scouring, and automated chemical cleaning.",
    thumbnailUrl: "/courses/aeration_blowers.jpg",
    estimatedHours: 4.0,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-mbr-1",
        courseId: "course-etp-102",
        order: 1,
        code: "2.1",
        title: "MBR Flux, TMP Monitoring & Relaxation Cycles",
        description: "Controlling net flux between 15-22 LMH, tracking Transmembrane Pressure (TMP < 0.35 bar), and 9-min filtration / 1-min relaxation cycles.",
        videoDurationMinutes: 2,
        competencyAreaId: "ca-etp-bio",
        readingContent:
          "Industrial MBR operates at high biomass density (MLSS 10,000 mg/L). Membrane fouling is mitigated by continuous coarse bubble scouring aeration. When TMP rises above 0.35 bar, maintenance cleaning with 500 ppm NaOCl and 1,000 ppm citric acid is triggered.",
        microQuiz: {
          id: "mq-mbr-1",
          abilityId: "ab-mbr-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-mbr-1",
              text: "What is the purpose of the 1-minute relaxation phase in an MBR filtration cycle?",
              options: [
                { id: "opt-a", text: "Allows air scouring bubbles to shear and dislodge the cake layer without permeation suction" },
                { id: "opt-b", text: "Lets the operator rest" },
                { id: "opt-c", text: "Heats the water up to 90 degrees" },
                { id: "opt-d", text: "Reverses biological nitrification" },
              ],
              correctOptionId: "opt-a",
              explanation: "During relaxation, permeate suction halts while aeration air scouring vigorously shakes fibers and strips foulants.",
            },
            {
              id: "q-mbr-2",
              text: "When Transmembrane Pressure (TMP) exceeds 0.35 bar during normal operation, what protocol is triggered?",
              options: [
                { id: "opt-a", text: "Initiate Maintenance Chemical Cleaning (CIP) with NaOCl and Citric Acid" },
                { id: "opt-b", text: "Increase permeate pump speed to force water through" },
                { id: "opt-c", text: "Turn off scouring air to reduce pressure" },
                { id: "opt-d", text: "Discard the membrane cassette immediately" },
              ],
              correctOptionId: "opt-a",
              explanation: "TMP > 0.35 bar signals pore blocking and requires chemical backwash/soak with sodium hypochlorite and citric acid.",
            },
            {
              id: "q-mbr-3",
              text: "What is the typical design net permeate flux range for industrial MBR installations?",
              options: [
                { id: "opt-a", text: "15 to 22 LMH (liters per square meter per hour)" },
                { id: "opt-b", text: "80 to 120 LMH" },
                { id: "opt-c", text: "1 to 2 LMH" },
                { id: "opt-d", text: "500 to 1000 LMH" },
              ],
              correctOptionId: "opt-a",
              explanation: "15–22 LMH prevents premature irreversible pore fouling while maintaining economic throughput.",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-mbr-1",
        text: "What is the typical MLSS range maintained in an industrial MBR biological tank?",
        options: [
          { id: "opt-a", text: "8,000 to 12,000 mg/L" },
          { id: "opt-b", text: "500 to 1,000 mg/L" },
          { id: "opt-c", text: "40,000 to 80,000 mg/L" },
          { id: "opt-d", text: "0 to 50 mg/L" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-mbr-1",
        text: "How does MBR effluent quality compare to conventional secondary clarifiers?",
        options: [
          { id: "opt-a", text: "Complete SDI and TSS removal (TSS < 1 mg/L, SDI < 2.5), serving as direct feed to Reverse Osmosis" },
          { id: "opt-b", text: "Produces more turbidity than clarifiers" },
          { id: "opt-c", text: "Requires tertiary sand filters before discharge" },
          { id: "opt-d", text: "Contains high suspended solids" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },
  {
    id: "course-slu-104",
    title: "Industrial Sludge Dewatering & Multi-Plate Filter Press",
    code: "ETP-103",
    section: "Effluent Treatment Plants (ETP)",
    jobCategoryId: "jc-etp-op",
    description:
      "Chemical sludge conditioning with cationic polyelectrolyte, volumetric feed pump controls, hydraulic ram compression (16–20 bar), and cake moisture analysis.",
    thumbnailUrl: "/courses/sludge_press.jpg",
    estimatedHours: 4.0,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-slu-1",
        courseId: "course-slu-104",
        order: 1,
        code: "3.1",
        title: "Filter Press Hydraulic Closing & Core Feed Pressure Cycle",
        description: "Operating hydraulic power pack, clamping plates to 250 bar, progressive cavity screw pump feeding, and core blowdown.",
        videoDurationMinutes: 1,
        competencyAreaId: "ca-etp-chem",
        readingContent:
          "Sludge must be conditioned with 2-4 kg/ton dry solids of cationic polyacrylamide. When feed pump reaches 7.0 bar and filtrate drip drops below 2 L/min, core blow air purge (4.0 bar) is activated before opening plates.",
        microQuiz: {
          id: "mq-slu-1",
          abilityId: "ab-slu-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-slu-1",
              text: "Target dry solids (DS) cake dryness from an industrial recessed plate filter press is:",
              options: [
                { id: "opt-a", text: "30% to 40% Dry Solids (moisture 60-70%)" },
                { id: "opt-b", text: "2% to 5% Dry Solids" },
                { id: "opt-c", text: "99% Bone Dry Solids" },
                { id: "opt-d", text: "10% Dry Solids" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-slu-1",
        text: "Why must filter cloth washing with high-pressure water jet be executed every 20-30 pressing cycles?",
        options: [
          { id: "opt-a", text: "To prevent blinding of polypropylene pores by fine chemical precipitates and polymer blinding" },
          { id: "opt-b", text: "To make the plates look shiny" },
          { id: "opt-c", text: "To decrease hydraulic pressure" },
          { id: "opt-d", text: "To dissolve the steel frame" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-slu-1",
        text: "Explain the danger of opening the filter press while the feed manifold is still pressurized:",
        options: [
          { id: "opt-a", text: "Violent sludge eruption causing severe operator chemical splash hazards and blindness" },
          { id: "opt-b", text: "Causes electric shock" },
          { id: "opt-c", text: "Improves cake dryness" },
          { id: "opt-d", text: "Increases pump lifespan" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },
  {
    id: "course-qac-402",
    title: "Jar Test Optimization & Coagulant Stoichiometry",
    code: "ETP-104",
    section: "Effluent Treatment Plants (ETP)",
    jobCategoryId: "jc-etp-op",
    description:
      "Standard 6-spindle jar test procedure to find the exact ppm dosage for Alum, Poly-Aluminum Chloride (PAC), lime, and anionic/cationic polymers.",
    thumbnailUrl: "/courses/jar_test_floc.jpg",
    estimatedHours: 3.5,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-qac-402-1",
        courseId: "course-qac-402",
        order: 1,
        code: "4.1",
        title: "6-Beaker Gradient Dosing, Flash Mix & Settling Velocity",
        description: "Preparing 1% stock solutions, executing 100 RPM flash mix (1 min), 30 RPM flocculation (15 min), and 20 min quiescent settling.",
        videoDurationMinutes: 2,
        competencyAreaId: "ca-etp-chem",
        readingContent:
          "Over-dosing coagulant produces pin-point flocs with residual turbidity. Under-dosing leaves colloidal color in suspension. Optimum coagulant is the lowest ppm that yields clear supernatant with fast settling flocs (> 1.5 cm/min).",
        microQuiz: {
          id: "mq-qac-402-1",
          abilityId: "ab-qac-402-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-qac-402-1",
              text: "Which parameter indicates the optimum coagulant dose in a completed jar test?",
              options: [
                { id: "opt-a", text: "Lowest chemical ppm yielding lowest residual NTU turbidity and rapid settling flocs" },
                { id: "opt-b", text: "Highest possible chemical quantity added" },
                { id: "opt-c", text: "Beaker with the highest foaming" },
                { id: "opt-d", text: "Beaker that boils first" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-qac-402",
        text: "Why must polyelectrolyte be mixed at low shear (< 30 RPM)?",
        options: [
          { id: "opt-a", text: "High shear mechanically shears and tears the long polymer molecular chains" },
          { id: "opt-b", text: "Polymer explodes under friction" },
          { id: "opt-c", text: "Polymer turns into solid rock" },
          { id: "opt-d", text: "To avoid evaporating the water" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-qac-402",
        text: "Calculate the daily PAC 10% solution requirement for 200 m³/day flow at 150 ppm dosage:",
        options: [
          { id: "opt-a", text: "300 kg/day of 10% commercial PAC solution (30 kg pure PAC active mass)" },
          { id: "opt-b", text: "3 kg/day" },
          { id: "opt-c", text: "3,000 kg/day" },
          { id: "opt-d", text: "30 grams/day" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },

  // ==========================================
  // 2. SEWAGE TREATMENT PLANTS (STP)
  // ==========================================
  {
    id: "course-stp-101",
    title: "Sequencing Batch Reactor (SBR) & Cyclic Batch Operations",
    code: "STP-101",
    section: "Sewage Treatment Plants (STP)",
    jobCategoryId: "jc-stp-op",
    description:
      "Cyclic batch treatment for municipal and commercial sewage: Fill, React (Aeration), Settle, Decant, and Idle phases with automated PLC cycle programming.",
    thumbnailUrl: "/courses/sbr_reactor.jpg",
    estimatedHours: 4.5,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-stp-101-1",
        courseId: "course-stp-101",
        order: 1,
        code: "1.1",
        title: "SBR 5-Phase Cycle Scheduling & Decanter Weir Calibration",
        description: "Configuring 4-hour and 6-hour batch cycle recipes: Anoxic Fill (60m), Aerated React (120m), Quiescent Settle (45m), Motorized Decant (45m), and Idle/Sludge Waste (10m).",
        videoDurationMinutes: 1,
        competencyAreaId: "ca-stp-sbr",
        readingContent:
          "SBR combines aeration and secondary clarification in a single basin. Motorized decanters with scum guards descend into clear supernatant without disturbing the settled sludge blanket at the tank floor. Target BOD5 < 10 mg/L and TSS < 10 mg/L.",
        microQuiz: {
          id: "mq-stp-101-1",
          abilityId: "ab-stp-101-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-stp-101-1",
              text: "During which SBR phase is blower aeration strictly turned off to allow gravity solids separation?",
              options: [
                { id: "opt-a", text: "Quiescent Settle Phase" },
                { id: "opt-b", text: "React Phase" },
                { id: "opt-c", text: "Aerated Fill Phase" },
                { id: "opt-d", text: "Blower testing phase" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-stp-101",
        text: "What safeguards prevent the motorized decanter from sucking settled sludge into the treated effluent sump?",
        options: [
          { id: "opt-a", text: "Sludge blanket optical level sensors and physical mechanical limit switches above the sludge bed" },
          { id: "opt-b", text: "Opening the bottom drain valve" },
          { id: "opt-c", text: "Running blowers during decanting" },
          { id: "opt-d", text: "Manual eyeball inspection only" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-stp-101",
        text: "Explain the biological mechanism of concurrent nitrification-denitrification in SBR cycles:",
        options: [
          { id: "opt-a", text: "Alternating oxic (aerobic DO 2.0 ppm) and anoxic (DO < 0.2 ppm) stages converts ammonia to nitrate, then nitrate to inert nitrogen gas" },
          { id: "opt-b", text: "Chlorine converts nitrogen into salt" },
          { id: "opt-c", text: "Microorganisms evaporate into the atmosphere" },
          { id: "opt-d", text: "Nitrogen is precipitated with Alum" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },
  {
    id: "course-stp-102",
    title: "Sewage Treatment (STP) & MBBR Bio-Carrier Operations",
    code: "STP-102",
    section: "Sewage Treatment Plants (STP)",
    jobCategoryId: "jc-stp-op",
    description:
      "Moving Bed Biofilm Reactor (MBBR) technology: virgin HDPE media filling ratios (40-60%), coarse bubble grid aeration, bio-carrier biofilm sloughing, and retention sieves.",
    thumbnailUrl: "/courses/mbbr_media.jpg",
    estimatedHours: 4.0,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-stp-102-1",
        courseId: "course-stp-102",
        order: 1,
        code: "2.1",
        title: "MBBR Media Fluidization, Dissolved Oxygen & Retention Screens",
        description: "Checking media movement with coarse bubble aeration, inspecting stainless steel retention wedge-wire sieves, and measuring active biofilm thickness.",
        videoDurationMinutes: 2,
        competencyAreaId: "ca-stp-sbr",
        readingContent:
          "MBBR bio-carriers (specific surface area > 600 m²/m³) must remain in continuous suspension without accumulating in dead corners. DO must be maintained > 2.5 ppm to penetrate the attached biofilm. Wedge-wire sieves prevent media carryover into the tube settler.",
        microQuiz: {
          id: "mq-stp-102-1",
          abilityId: "ab-stp-102-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-stp-102-1",
              text: "What is the primary operational advantage of MBBR over conventional Activated Sludge Process (ASP)?",
              options: [
                { id: "opt-a", text: "Higher biological capacity in a much smaller tank footprint without sludge return (RAS) recycling" },
                { id: "opt-b", text: "Eliminates need for oxygen blowers" },
                { id: "opt-c", text: "Requires zero power" },
                { id: "opt-d", text: "Turns sewage into pure steam" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-stp-102",
        text: "What indicates severe MBBR media blinding or sieve blockage?",
        options: [
          { id: "opt-a", text: "Rising water level upstream of the sieve causing tank overflow while downstream pump starves" },
          { id: "opt-b", text: "Excessive dissolved oxygen" },
          { id: "opt-c", text: "Clear water everywhere" },
          { id: "opt-d", text: "Media dissolves in water" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-stp-102",
        text: "How is excess aged biofilm removed from MBBR carriers?",
        options: [
          { id: "opt-a", text: "Shearing forces from turbulent air bubble collisions continuously slough aged biomass, which settles in the secondary clarifier" },
          { id: "opt-b", text: "Carriers must be scooped out and washed by hand" },
          { id: "opt-c", text: "Acid is added to dissolve the media" },
          { id: "opt-d", text: "Biofilm never sheds" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },
  {
    id: "course-stp-103",
    title: "Skid-Mounted Packaged STPs for Small Footprint Treatment",
    code: "STP-103",
    section: "Sewage Treatment Plants (STP)",
    jobCategoryId: "jc-stp-op",
    description:
      "Operation and commissioning of compact containerized and skid-mounted sewage treatment plants for residential complexes, IT parks, and modular commercial installations.",
    thumbnailUrl: "/courses/skid_stp.jpg",
    estimatedHours: 3.5,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-stp-103-1",
        courseId: "course-stp-103",
        order: 1,
        code: "3.1",
        title: "Plug-and-Play Skid Components, Submersible Cutters & Tube Settlers",
        description: "Checking dual submersible macerator pumps, integrated high-rate inclined tube settler modules, and sodium hypochlorite disinfection dosing.",
        videoDurationMinutes: 1,
        competencyAreaId: "ca-stp-skid",
        readingContent:
          "Packaged STPs are pre-piped on epoxy-coated structural steel skids. Daily inspections include pump running hours rotation, checking 60-degree PVC tube settler modules for algae fouling, and maintaining free chlorine residual at 0.5–1.0 ppm in treated water tanks.",
        microQuiz: {
          id: "mq-stp-103-1",
          abilityId: "ab-stp-103-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-stp-103-1",
              text: "Why are macerator cutter pumps installed in raw sewage collection sumps?",
              options: [
                { id: "opt-a", text: "Shred fibrous textiles and sanitary debris to prevent jamming skid valves and fine bubble diffusers" },
                { id: "opt-b", text: "To heat sewage to 50 degrees" },
                { id: "opt-c", text: "To aerate the water with oxygen" },
                { id: "opt-d", text: "To add chlorine to the inlet" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-stp-103",
        text: "What treated water standard must skid-mounted STPs achieve for toilet flushing and landscape reuse in India?",
        options: [
          { id: "opt-a", text: "BOD < 10 mg/L, TSS < 10 mg/L, Turbidity < 2 NTU, Fecal Coliform Nil / 100 mL" },
          { id: "opt-b", text: "BOD < 350 mg/L" },
          { id: "opt-c", text: "Zero dissolved oxygen" },
          { id: "opt-d", text: "TDS > 10,000 mg/L" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-stp-103",
        text: "Explain the monthly preventive maintenance checklist for compact skid-mounted STPs:",
        options: [
          { id: "opt-a", text: "De-sludging tube settler hoppers, checking blower belt tension, cleaning level switch probes, and refilling dosing tanks" },
          { id: "opt-b", text: "Painting the skid frame every day" },
          { id: "opt-c", text: "Emptying all water into public drains" },
          { id: "opt-d", text: "Disconnecting all electrical sensors" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },

  // ==========================================
  // 3. WATER TREATMENT PLANTS (WTP)
  // ==========================================
  {
    id: "course-ops-301",
    title: "Industrial RO Membrane Operations & CIP Descaling",
    code: "WTP-201",
    section: "Water Treatment Plants (WTP)",
    jobCategoryId: "jc-wtp-tech",
    description:
      "Reverse Osmosis principles, cartridge filter ΔP, Silt Density Index (SDI < 3), normalized permeate flux monitoring, and automated 2-stage Clean-In-Place (CIP) descaling.",
    thumbnailUrl: "/courses/ro_membrane.jpg",
    estimatedHours: 4.5,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-ro-1",
        courseId: "course-ops-301",
        order: 1,
        code: "1.1",
        title: "RO Operating Parameters, Recovery Ratio & Salt Rejection",
        description: "Calculating system recovery (70-75%), normalized salt rejection (> 98.5%), and measuring Stage 1 & Stage 2 differential pressure.",
        videoDurationMinutes: 2,
        competencyAreaId: "ca-wtp-ro",
        readingContent:
          "Normalized permeate flow rate must be calculated daily. A 10-15% decline in normalized flow, or a 15% increase in differential pressure (ΔP), signals immediate requirement for Clean-In-Place (CIP) before irreversible scale compaction occurs.",
        microQuiz: {
          id: "mq-ro-1",
          abilityId: "ab-ro-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-ro-1",
              text: "Which Silt Density Index (SDI 15) limit is mandatory for spiral-wound polyamide RO membranes?",
              options: [
                { id: "opt-a", text: "SDI < 3.0 (Maximum limit < 5.0)" },
                { id: "opt-b", text: "SDI > 25.0" },
                { id: "opt-c", text: "SDI does not matter for RO" },
                { id: "opt-d", text: "SDI between 80 and 100" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
      {
        id: "ab-ro-2",
        courseId: "course-ops-301",
        order: 2,
        code: "1.2",
        title: "2-Stage Chemical Cleaning (CIP) Protocol",
        description: "Low-pH citric acid descaling for calcium carbonate scale, followed by high-pH NaOH/EDTA cleaning for bio-slime and organic foulants.",
        videoDurationMinutes: 1,
        competencyAreaId: "ca-wtp-ro",
        readingContent:
          "Stage 1 Acid Wash uses 2.0% Citric Acid at pH 2.0–3.0 to dissolve metal hydroxides and carbonate scaling. Stage 2 Alkali Wash uses 0.1% NaOH with 0.1% Na-EDTA at pH 11.0–12.0 (temp < 35°C) to break organic foulants and biological slime.",
        microQuiz: {
          id: "mq-ro-2",
          abilityId: "ab-ro-2",
          passThreshold: 70,
          questions: [
            {
              id: "q-ro-2",
              text: "Why must maximum CIP cleaning temperature be restricted below 35°C during high pH (> 11) wash?",
              options: [
                { id: "opt-a", text: "High temperature and high pH hydrolyzes and degrades the polyamide thin-film composite membrane" },
                { id: "opt-b", text: "It causes water boiling in the CIP tank" },
                { id: "opt-c", text: "It trips the motor thermal overload" },
                { id: "opt-d", text: "To avoid melting the stainless steel pipes" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-ro-1",
        text: "What causes rapid irreversible degradation of polyamide RO membranes within hours?",
        options: [
          { id: "opt-a", text: "Exposure to free chlorine / strong oxidizing agents (ORP > 200 mV)" },
          { id: "opt-b", text: "High calcium hardness" },
          { id: "opt-c", text: "Cold winter feed water" },
          { id: "opt-d", text: "Very low turbidity" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-ro-1",
        text: "Explain the role of Sodium Metabisulfite (SMBS) dosing upstream of the RO booster pump:",
        options: [
          { id: "opt-a", text: "Dechlorination: Scavenges residual free chlorine through stoichiometric reduction to protect polyamide membranes" },
          { id: "opt-b", text: "Disinfects bacteria in the permeate" },
          { id: "opt-c", text: "Increases water pH to 14" },
          { id: "opt-d", text: "Precipitates silica" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },
  {
    id: "course-ops-304",
    title: "Ultrafiltration (UF) & Membrane Integrity Testing",
    code: "WTP-202",
    section: "Water Treatment Plants (WTP)",
    jobCategoryId: "jc-wtp-tech",
    description:
      "Hollow-fiber PVDF ultrafiltration operations: dead-end & cross-flow filtration, automated air scouring, backwash chemical dosing, and pressure decay integrity tests.",
    thumbnailUrl: "/courses/stp_plant_real.jpg",
    estimatedHours: 4.0,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-ops-304-1",
        courseId: "course-ops-304",
        order: 1,
        code: "2.1",
        title: "UF Pressure Decay Test (PDT) & Fiber Pinning SOP",
        description: "Isolating hollow fiber modules, pressurizing lumen to 1.0 bar air, measuring decay rate (< 0.05 bar/5 min), and pin repairing cut fibers.",
        videoDurationMinutes: 2,
        competencyAreaId: "ca-wtp-uf",
        readingContent:
          "Daily Pressure Decay Tests (PDT) confirm UF membrane barrier integrity. A pressure drop > 0.1 bar in 3 minutes indicates broken hollow fibers, allowing particulate passage to downstream RO membranes.",
        microQuiz: {
          id: "mq-ops-304-1",
          abilityId: "ab-ops-304-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-ops-304-1",
              text: "What pore size characterizes typical Ultrafiltration (UF) water treatment membranes?",
              options: [
                { id: "opt-a", text: "0.01 to 0.02 microns (retains bacteria, viruses, and colloids)" },
                { id: "opt-b", text: "1.0 to 5.0 millimeters" },
                { id: "opt-c", text: "0.0001 microns" },
                { id: "opt-d", text: "100 microns" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-ops-304",
        text: "What is Chemically Enhanced Backwash (CEB) in industrial UF systems?",
        options: [
          { id: "opt-a", text: "Backwash cycle injected with sodium hypochlorite (NaOCl) and citric acid to break biofouling and scale" },
          { id: "opt-b", text: "Running clean tap water" },
          { id: "opt-c", text: "Scraping fibers with steel wire" },
          { id: "opt-d", text: "Boiling the UF skid" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-ops-304",
        text: "Describe the step-by-step sequence of an automated UF Backwash cycle:",
        options: [
          { id: "opt-a", text: "1. Air scour fluidization (30s) -> 2. Bottom drain flush -> 3. High-rate permeate backwash pump with chemical injection -> 4. Forward rinse" },
          { id: "opt-b", text: "Turn off all pumps and wait" },
          { id: "opt-c", text: "Reverse electrical polarity of motors" },
          { id: "opt-d", text: "Flush with diesel fuel" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },
  {
    id: "course-ops-303",
    title: "High Purity Water Plants: Dual Media & EDI Demineralization",
    code: "WTP-203",
    section: "Water Treatment Plants (WTP)",
    jobCategoryId: "jc-wtp-tech",
    description:
      "Dual Media Filters (sand + anthracite), Activated Carbon dechlorination, and continuous Electrodeionization (EDI) polishing for boiler feed and pharma ultrapure water.",
    thumbnailUrl: "/courses/edi_purification.jpg",
    estimatedHours: 4.0,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-ops-303-1",
        courseId: "course-ops-303",
        order: 1,
        code: "3.1",
        title: "Electrodeionization (EDI) Current Control & Resistivity Monitoring",
        description: "Operating DC rectifier current (1.5–4.0 A), monitoring concentrate bleed flow, and maintaining product resistivity > 15 MΩ·cm (< 0.06 µS/cm).",
        videoDurationMinutes: 1,
        competencyAreaId: "ca-wtp-uf",
        readingContent:
          "EDI utilizes electrical current to continuously regenerate mixed-bed ion exchange resins without hazardous chemical regenerants. Feed water must be double-pass RO permeate with hardness < 0.5 ppm and silica < 0.5 ppm to prevent fatal module scaling.",
        microQuiz: {
          id: "mq-ops-303-1",
          abilityId: "ab-ops-303-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-ops-303-1",
              text: "What product water resistivity indicates high purity pharmaceutical water from an EDI stack?",
              options: [
                { id: "opt-a", text: "> 10 to 15 MegaOhm-cm (Conductivity < 0.1 microSiemens/cm)" },
                { id: "opt-b", text: "1,500 microSiemens/cm" },
                { id: "opt-c", text: "50,000 ppm TDS" },
                { id: "opt-d", text: "Zero resistance" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-ops-303",
        text: "What happens if raw unsoftened water containing 200 ppm hardness is fed to an EDI stack?",
        options: [
          { id: "opt-a", text: "Instant calcium carbonate precipitation inside concentrate chambers, causing irreversible module burn-out" },
          { id: "opt-b", text: "Improves electrical efficiency" },
          { id: "opt-c", text: "Nothing happens" },
          { id: "opt-d", text: "Current drops to zero with pure water" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-ops-303",
        text: "Explain the continuous electrochemical regeneration process in an EDI module:",
        options: [
          { id: "opt-a", text: "DC electrical potential splits water molecules into H+ and OH- ions, continuously regenerating resin beads while moving ions through selective membranes" },
          { id: "opt-b", text: "Hydrochloric acid and caustic soda must be pumped daily" },
          { id: "opt-c", text: "Resin beads are burned away" },
          { id: "opt-d", text: "Magnets capture iron particles" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },
  {
    id: "course-ops-302",
    title: "High-Pressure Feed Booster Pumps & VFD Control in Water Plants",
    code: "WTP-204",
    section: "Water Treatment Plants (WTP)",
    jobCategoryId: "jc-wtp-tech",
    description:
      "Operation of vertical multistage high-pressure booster pumps (Grundfos/CNP), cavitation prevention, VFD soft start ramp-up, and mechanical seal cooling.",
    thumbnailUrl: "/courses/high_pressure_pumps.jpg",
    estimatedHours: 3.5,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-ops-302-1",
        courseId: "course-ops-302",
        order: 1,
        code: "4.1",
        title: "VFD Ramp-Up Frequency, Suction Pressure Interlocks & NPSHa",
        description: "Checking low suction pressure cutoff switch (< 1.5 bar), setting 30-sec VFD acceleration curve, and monitoring discharge surge dampeners.",
        videoDurationMinutes: 2,
        competencyAreaId: "ca-wtp-ro",
        readingContent:
          "High-pressure RO booster pumps operate between 14.0 and 65.0 bar. Never start high-pressure pumps against a closed discharge valve without VFD soft start. Suction pressure switch must trip the pump immediately if inlet drops below 1.5 bar to avoid cavitation.",
        microQuiz: {
          id: "mq-ops-302-1",
          abilityId: "ab-ops-302-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-ops-302-1",
              text: "What safety interlock prevents devastating cavitation damage in an RO high-pressure booster pump?",
              options: [
                { id: "opt-a", text: "Low Suction Pressure Pressure Transmitter (PT) Interlock (< 1.5 bar)" },
                { id: "opt-b", text: "High temperature alarm on the roof" },
                { id: "opt-c", text: "Door lock switch" },
                { id: "opt-d", text: "Lighting sensor" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-ops-302",
        text: "What symptom indicates cavitation inside a multistage centrifugal high-pressure pump?",
        options: [
          { id: "opt-a", text: "Crackling marble/gravel noise inside the casing with fluctuating discharge pressure and severe vibration" },
          { id: "opt-b", text: "Smooth silent rotation" },
          { id: "opt-c", text: "Water turns into ice" },
          { id: "opt-d", text: "Blower stops" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-ops-302",
        text: "Why is water hammer dangerous in high-pressure RO header piping?",
        options: [
          { id: "opt-a", text: "Pressure shockwaves rupture fiberglass membrane pressure vessels, smash end caps, and shatter pipe welds" },
          { id: "opt-b", text: "It causes water discoloration" },
          { id: "opt-c", text: "It reduces electrical consumption" },
          { id: "opt-d", text: "It accelerates bacteria growth" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },

  // ==========================================
  // 4. ZERO LIQUID DISCHARGE (ZLD)
  // ==========================================
  {
    id: "course-zld-301",
    title: "Multiple Effect Evaporator (MEE) & Steam Economy Optimization",
    code: "ZLD-301",
    section: "Zero Liquid Discharge (ZLD)",
    jobCategoryId: "jc-zld-eng",
    description:
      "Operation of multi-effect falling/forced circulation thermal evaporators: vacuum ejector systems, forward/backward feed flow, condensate recovery, and steam economy.",
    thumbnailUrl: "/courses/multiple_effect_evaporator.jpg",
    estimatedHours: 4.5,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-zld-301-1",
        courseId: "course-zld-301",
        order: 1,
        code: "1.1",
        title: "Vacuum Profiling, Calandria Boiling & Steam Economy Ratios",
        description: "Setting vacuum across effects (-0.2, -0.5, -0.85 bar), monitoring steam pressure (3.0 bar), and calculating steam economy (> 2.8 kg water evaporated / kg steam).",
        videoDurationMinutes: 1,
        competencyAreaId: "ca-zld-mee",
        readingContent:
          "Multiple Effect Evaporators achieve high thermal efficiency by using vapor generated from the first effect as heating steam for the subsequent lower-pressure effect. Target density of concentrated liquor leaving the final effect is 1.18–1.24 g/cm³ before feeding the ATFD.",
        microQuiz: {
          id: "mq-zld-301-1",
          abilityId: "ab-zld-301-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-zld-301-1",
              text: "In a 3-Effect Evaporator, why is vacuum progressively deeper from Effect 1 to Effect 3?",
              options: [
                { id: "opt-a", text: "Decreasing pressure lowers the boiling point, allowing previous stage vapor to boil subsequent liquor" },
                { id: "opt-b", text: "To suck all water into the chimney" },
                { id: "opt-c", text: "To freeze the salt" },
                { id: "opt-d", text: "To save on steel construction" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-zld-301",
        text: "What operational consequence occurs when calandria heat exchanger tubes suffer severe mineral scaling?",
        options: [
          { id: "opt-a", text: "Heat transfer coefficient drops dramatically, steam consumption surges, and evaporator output collapses" },
          { id: "opt-b", text: "Vapor becomes colder" },
          { id: "opt-c", text: "Evaporator runs without electricity" },
          { id: "opt-d", text: "Clean water output doubles" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-zld-301",
        text: "Explain the procedure for in-situ chemical descaling of an MEE calandria tube bundle:",
        options: [
          { id: "opt-a", text: "Recirculate 5% sulfamic acid with corrosion inhibitors at 65°C for 4 hours, followed by alkaline caustic boil-out and high-pressure jet wash" },
          { id: "opt-b", text: "Hammer the tubes with iron rods" },
          { id: "opt-c", text: "Dump sand into the boiling chamber" },
          { id: "opt-d", text: "Paint the inside of the tubes" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },
  {
    id: "course-zld-302",
    title: "Agitated Thin Film Dryer (ATFD) & Salt Crystallization",
    code: "ZLD-302",
    section: "Zero Liquid Discharge (ZLD)",
    jobCategoryId: "jc-zld-eng",
    description:
      "Operation of vertical/horizontal ATFD systems: mechanical rotor blade clearance, hot thermal oil/steam jacket control, vacuum vapor condenser, and dry salt cake discharge.",
    thumbnailUrl: "/courses/industrial_evaporator.jpg",
    estimatedHours: 4.0,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-zld-302-1",
        courseId: "course-zld-302",
        order: 1,
        code: "2.1",
        title: "Rotor Clearance Adjustment, Heating Jacket Balance & Salt Bagging",
        description: "Checking rotor blade tip clearance (1.5 mm), managing 140°C thermal oil circulation, and bagging dry solid crystalline salt cake.",
        videoDurationMinutes: 2,
        competencyAreaId: "ca-zld-atfd",
        readingContent:
          "The ATFD spreads concentrated brine into a thin turbulent film against the heated inner wall. Water flashes into vapor while dry salt crystals drop through the bottom rotary airlock valve into bagging stations. Salt moisture must be maintained < 5%.",
        microQuiz: {
          id: "mq-zld-302-1",
          abilityId: "ab-zld-302-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-zld-302-1",
              text: "What dry salt cake moisture content is required for hazardous waste landfill storage compliance?",
              options: [
                { id: "opt-a", text: "< 5% to 8% Moisture (free-flowing dry crystalline powder)" },
                { id: "opt-b", text: "90% liquid sludge" },
                { id: "opt-c", text: "50% slurry" },
                { id: "opt-d", text: "Moisture does not matter" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-zld-302",
        text: "What causes severe motor trip and mechanical rotor seizure in an operational ATFD?",
        options: [
          { id: "opt-a", text: "Feed rate too high relative to heat input, causing wet paste build-up that locks the rotor blades against the heated wall" },
          { id: "opt-b", text: "Low water level in cooling tower" },
          { id: "opt-c", text: "Clean condensate tank" },
          { id: "opt-d", text: "Low ambient humidity" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-zld-302",
        text: "Describe the environmental significance of Zero Liquid Discharge (ZLD) compliance in industrial chemical manufacturing:",
        options: [
          { id: "opt-a", text: "100% of wastewater is recovered as reusable condensate, with zero liquid effluent discharged into rivers or ground, leaving only dry inert salt cake for disposal" },
          { id: "opt-b", text: "It allows companies to discharge sewage into groundwater" },
          { id: "opt-c", text: "It converts water into gasoline" },
          { id: "opt-d", text: "It increases raw water intake" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },
  {
    id: "course-zld-303",
    title: "High Recovery Brine Concentration RO & Scaling Prevention",
    code: "ZLD-303",
    section: "Zero Liquid Discharge (ZLD)",
    jobCategoryId: "jc-zld-eng",
    description:
      "High osmotic pressure membrane systems: operating at 70–80 bar, silica and barium sulfate supersaturation control, specialized antiscalants, and brine concentration.",
    thumbnailUrl: "/courses/brine_desalination.jpg",
    estimatedHours: 4.0,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-zld-303-1",
        courseId: "course-zld-303",
        order: 1,
        code: "3.1",
        title: "Brine RO Osmotic Pressure Calculations & Feed Optimization",
        description: "Estimating osmotic pressure (1 bar per 1,000 ppm TDS), maintaining flux balance, and preventing gypsum/silica crystal nucleations.",
        videoDurationMinutes: 1,
        competencyAreaId: "ca-zld-mee",
        readingContent:
          "High Recovery Brine RO concentrates industrial ETP permeate from 5,000 ppm up to 60,000–80,000 ppm TDS before sending it to thermal evaporators. This cuts MEE steam and capital size requirements by 70%. Specialized phosphonate antiscalants prevent silica precipitation.",
        microQuiz: {
          id: "mq-zld-303-1",
          abilityId: "ab-zld-303-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-zld-303-1",
              text: "Why is Brine Concentration RO installed ahead of thermal MEE evaporators in modern ZLD plants?",
              options: [
                { id: "opt-a", text: "Drastically reduces thermal evaporator volume and steam fuel consumption by concentrating brine with high-efficiency membrane power" },
                { id: "opt-b", text: "To eliminate the need for pumps" },
                { id: "opt-c", text: "To make water colder" },
                { id: "opt-d", text: "To add color to the effluent" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-zld-303",
        text: "What is the maximum feed TDS that high-pressure disc-tube or seawater RO membranes can typically concentrate to?",
        options: [
          { id: "opt-a", text: "60,000 to 80,000 mg/L TDS (limited by 80-120 bar pressure vessel safety rating)" },
          { id: "opt-b", text: "500 mg/L" },
          { id: "opt-c", text: "500,000 mg/L" },
          { id: "opt-d", text: "Zero TDS" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-zld-303",
        text: "Explain how silica solubility changes with pH in high-recovery membrane systems:",
        options: [
          { id: "opt-a", text: "Silica solubility increases dramatically above pH 9.5 (dissociates into silicate ions), allowing higher recovery without amorphous silica fouling" },
          { id: "opt-b", text: "Silica precipitates immediately at pH 10" },
          { id: "opt-c", text: "pH has no impact on silica" },
          { id: "opt-d", text: "Acid dissolves silica crystals" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },

  // ==========================================
  // 5. ENVIRONMENTAL CONSULTING SERVICES
  // ==========================================
  {
    id: "course-qac-401",
    title: "Comprehensive Industrial Water Audits & Mass Balance",
    code: "ENV-401",
    section: "Environmental Consulting Services",
    jobCategoryId: "jc-env-consultant",
    description:
      "Industrial water balance auditing: inlet source metering, process consumption mapping, cooling tower / boiler blowdown recycling, loss identification, and conservation roadmaps.",
    thumbnailUrl: "/courses/water_lab_testing.jpg",
    estimatedHours: 4.5,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-env-401-1",
        courseId: "course-qac-401",
        order: 1,
        code: "1.1",
        title: "Plant Water Footprint Mapping & Sankey Diagram Generation",
        description: "Conducting ultrasonic flow verification, balancing inlet abstraction against consumptive use and effluent generation, and accounting for unmetered losses.",
        videoDurationMinutes: 2,
        competencyAreaId: "ca-env-audit",
        readingContent:
          "A professional water audit establishes exact volumetric input versus output. Total Raw Water Intake = Process Consumption + Evaporative Cooling Loss + Boiler Losses + Domestic + Effluent Generation. Unaccounted losses must not exceed 3-5% in certified green industrial plants.",
        microQuiz: {
          id: "mq-env-401-1",
          abilityId: "ab-env-401-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-env-401-1",
              text: "Which non-invasive instrument is used by Nectar auditors to verify piping flow without cutting pipes?",
              options: [
                { id: "opt-a", text: "Clamp-on Ultrasonic Transit-Time Flow Meter" },
                { id: "opt-b", text: "Mercury thermometer" },
                { id: "opt-c", text: "Hacksaw" },
                { id: "opt-d", text: "pH paper strip" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-env-401",
        text: "What is the single largest water loss in most chemical processing and thermal power plants?",
        options: [
          { id: "opt-a", text: "Evaporative and drift losses from cooling towers (typically 60-80% of total makeup)" },
          { id: "opt-b", text: "Cafeteria drinking taps" },
          { id: "opt-c", text: "Rainwater collection" },
          { id: "opt-d", text: "Fire hose testing" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-env-401",
        text: "Outline the 4 core phases of a comprehensive Nectar industrial water audit:",
        options: [
          { id: "opt-a", text: "1. Inception & Historical Data Review -> 2. On-Site Ultrasonic Flow Measurement -> 3. Mass Balance & Specific Water Consumption (SWC) Analysis -> 4. Techno-Economic Conservation Report" },
          { id: "opt-b", text: "1. Look around -> 2. Guess numbers -> 3. Sign document" },
          { id: "opt-c", text: "1. Stop all water -> 2. Leave site" },
          { id: "opt-d", text: "1. Call the municipality -> 2. Close factory" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },
  {
    id: "course-env-402",
    title: "On-Site Treatability Studies & Bench-Scale Evaluation",
    code: "ENV-402",
    section: "Environmental Consulting Services",
    jobCategoryId: "jc-env-consultant",
    description:
      "Bench-scale treatability evaluations for complex effluent: multi-coagulant screening, Fenton oxidation for refractory COD, anaerobic biomethanation potential, and kinetic testing.",
    thumbnailUrl: "/courses/chemical_safety.jpg",
    estimatedHours: 4.0,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-env-402-1",
        courseId: "course-env-402",
        order: 1,
        code: "2.1",
        title: "Advanced Oxidation Process (Fenton) & Refractory COD Destruction",
        description: "Optimizing FeSO4 : H2O2 stoichiometric ratio at pH 3.0, observing hydroxyl radical generation, and neutralizing to precipitate iron sludge.",
        videoDurationMinutes: 1,
        competencyAreaId: "ca-env-treat",
        readingContent:
          "Treatability studies determine the viability of process upgrades. For non-biodegradable pharmaceutical effluent (BOD:COD ratio < 0.2), classical Fenton oxidation (Fe2+ + H2O2 -> Fe3+ + ·OH + OH-) generates powerful hydroxyl radicals that cleave aromatic ring compounds, boosting biodegradability.",
        microQuiz: {
          id: "mq-env-402-1",
          abilityId: "ab-env-402-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-env-402-1",
              text: "What reaction pH must be strictly maintained for optimum Fenton advanced oxidation?",
              options: [
                { id: "opt-a", text: "pH 2.8 to 3.2" },
                { id: "opt-b", text: "pH 11.0 to 13.0" },
                { id: "opt-c", text: "pH 7.0 to 7.4" },
                { id: "opt-d", text: "pH 0.1" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-env-402",
        text: "What does an effluent BOD:COD ratio greater than 0.45 signify?",
        options: [
          { id: "opt-a", text: "High biodegradability; wastewater is ideally suited for aerobic biological treatment" },
          { id: "opt-b", text: "Toxic recalcitrant wastewater that will kill all bacteria" },
          { id: "opt-c", text: "Water contains pure motor oil" },
          { id: "opt-d", text: "Cannot be treated" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-env-402",
        text: "Explain the purpose of an on-site treatability pilot trial before erecting turnkey ETP/ZLD plants:",
        options: [
          { id: "opt-a", text: "Verifies sizing kinetics, exact chemical op-ex, sludge generation rates, and prevents catastrophic under-design on live plant effluent" },
          { id: "opt-b", text: "To delay plant construction" },
          { id: "opt-c", text: "To spend client budget" },
          { id: "opt-d", text: "Only done for aesthetic reasons" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },
  {
    id: "course-qac-403",
    title: "Statutory Environmental Audits & Consent Services (CTE/CTO)",
    code: "ENV-403",
    section: "Environmental Consulting Services",
    jobCategoryId: "jc-env-consultant",
    description:
      "State Pollution Control Board (SPCB) and CPCB compliance: Consent to Establish (CTE), Consent to Operate (CTO) renewal, Hazardous Waste Form 4/10 manifests, and Environmental Statement (Form V).",
    thumbnailUrl: "/courses/environmental_audit.jpg",
    estimatedHours: 4.0,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-env-403-1",
        courseId: "course-qac-403",
        order: 1,
        code: "3.1",
        title: "Consent Management & Hazardous Waste Manifest (Form 10) Tracking",
        description: "Preparing documentation for CTE capital expansion, CTO annual discharge limits, and 7-copy color-coded hazardous waste manifest filings.",
        videoDurationMinutes: 2,
        competencyAreaId: "ca-env-audit",
        readingContent:
          "All operating industrial facilities must hold a valid Consent to Operate (CTO) specifying max discharge volume (KLD) and outlet parameters. Hazardous chemical sludge, ETP filter cake, and spent carbon must be logged under Hazardous Waste Management Rules 2016 with online SPCB manifest tracking.",
        microQuiz: {
          id: "mq-env-403-1",
          abilityId: "ab-env-403-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-env-403-1",
              text: "Which statutory document is submitted annually by September 30th to SPCB summarizing water, raw material, and pollution metrics?",
              options: [
                { id: "opt-a", text: "Environmental Statement Form V (Form 5)" },
                { id: "opt-b", text: "Income tax return" },
                { id: "opt-c", text: "Daily attendance card" },
                { id: "opt-d", text: "Safety checklist" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-env-403",
        text: "What is the legal difference between Consent to Establish (CTE) and Consent to Operate (CTO)?",
        options: [
          { id: "opt-a", text: "CTE is permission to construct/install plant machinery; CTO is statutory permission to commence live production and discharge" },
          { id: "opt-b", text: "They are identical documents" },
          { id: "opt-c", text: "CTE is for drivers; CTO is for managers" },
          { id: "opt-d", text: "Neither is legally mandatory" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-env-403",
        text: "Explain the protocol for storing hazardous ETP chemical sludge on site prior to TSDF dispatch:",
        options: [
          { id: "opt-a", text: "Impervious concrete floor, HDPE liner containment bund, covered roof sheds, leachate collection sump, and max 90 days storage limit" },
          { id: "opt-b", text: "Dump openly on open soil" },
          { id: "opt-c", text: "Throw into the public municipal bin" },
          { id: "opt-d", text: "Store indefinitely in cardboard boxes" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },
  {
    id: "course-qac-404",
    title: "OCEMS Online Continuous Effluent Monitoring & Telemetry",
    code: "ENV-404",
    section: "Environmental Consulting Services",
    jobCategoryId: "jc-env-consultant",
    description:
      "CPCB/SPCB real-time telemetry: optical DO sensors, UV-Vis spectrophotometric COD/BOD analyzers, electromagnetic flow meters, and server handshake protocol verification.",
    thumbnailUrl: "/courses/ocems_telemetry.jpg",
    estimatedHours: 3.5,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-env-404-1",
        courseId: "course-qac-404",
        order: 1,
        code: "4.1",
        title: "OCEMS Analyzer 2-Point Calibration & Telemetry Data Uptime",
        description: "Zero and span calibration on UV-Vis optical probes, cleaning measuring flow cells, and maintaining > 85% data uptime to CPCB portal.",
        videoDurationMinutes: 1,
        competencyAreaId: "ca-env-audit",
        readingContent:
          "17-Category industrial plants must transmit real-time effluent telemetry (pH, COD, BOD, TSS, Flow) to CPCB and SPCB servers 24/7. Auto-cleaning wipers, monthly standard sample verification, and optical cell descaling ensure regulatory compliance without false violation alarms.",
        microQuiz: {
          id: "mq-env-404-1",
          abilityId: "ab-env-404-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-env-404-1",
              text: "What minimum data availability percentage is mandated by CPCB guidelines for industrial OCEMS systems?",
              options: [
                { id: "opt-a", text: "> 85% Data Availability Uptime" },
                { id: "opt-b", text: "10% uptime" },
                { id: "opt-c", text: "50% uptime" },
                { id: "opt-d", text: "100% uptime only once a month" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-env-404",
        text: "What immediate action is required if the online OCEMS analyzer triggers an automatic SMS threshold breach alert?",
        options: [
          { id: "opt-a", text: "Immediately divert final effluent to the emergency holding basin and perform laboratory grab sample verification within 30 minutes" },
          { id: "opt-b", text: "Unplug the internet router to hide the data" },
          { id: "opt-c", text: "Ignore the alert" },
          { id: "opt-d", text: "Smash the sensor" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-env-404",
        text: "Explain how modern UV-Vis absorption spectroscopy estimates real-time COD without chemical reagents:",
        options: [
          { id: "opt-a", text: "Measures light absorbance across 200–750 nm spectrum; organic molecules absorb UV at 254 nm, correlating directly to COD through calibrated multi-wavelength algorithms" },
          { id: "opt-b", text: "Uses microwave heating to burn water" },
          { id: "opt-c", text: "Measures electrical resistance only" },
          { id: "opt-d", text: "Counts bacteria under microscope camera" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },

  // ==========================================
  // 6. OPERATION AND MAINTENANCE (O&M)
  // ==========================================
  {
    id: "course-onm-501",
    title: "Deputed Manpower Protocols & Monthly WQ&Q Reporting",
    code: "ONM-501",
    section: "Operation and Maintenance (O&M)",
    jobCategoryId: "jc-onm-lead",
    description:
      "Nectar deputed site manpower standards: shift handover protocols, daily logsheet verification, chemical consumption reconciliation, and monthly Water Quality & Quantity (WQ&Q) analytical dossier delivery.",
    thumbnailUrl: "/courses/etp_plant.jpg",
    estimatedHours: 4.5,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-onm-501-1",
        courseId: "course-onm-501",
        order: 1,
        code: "1.1",
        title: "Standardized Daily Logsheet Entry & Shift Handover Rigor",
        description: "Logging flow meter readings, pump run-hours, chemical additions (kg), MLSS, DO, pH, and documenting abnormal operational alerts for incoming shift leads.",
        videoDurationMinutes: 2,
        competencyAreaId: "ca-onm-report",
        readingContent:
          "Nectar's O&M reputation relies on immaculate logsheet discipline. Every shift operator must verify flow meter integrators at 07:00, 15:00, and 23:00 hrs. A joint inspection walk of all rotating machinery with the incoming shift in-charge is mandatory before signing the handover register.",
        microQuiz: {
          id: "mq-onm-501-1",
          abilityId: "ab-onm-501-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-onm-501-1",
              text: "Which parameter must be reconciled daily to detect hidden chemical overdosing or pump calibration drift?",
              options: [
                { id: "opt-a", text: "Chemical mass consumption (kg) divided by total treated wastewater volume (m³) = specific ppm dosage" },
                { id: "opt-b", text: "Number of operator tea breaks" },
                { id: "opt-c", text: "Color of the chemical drum label" },
                { id: "opt-d", text: "Ambient outside air temperature" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
      {
        id: "ab-onm-501-2",
        courseId: "course-onm-501",
        order: 2,
        code: "1.2",
        title: "Monthly Assessment of Water Quality & Quantity (WQ&Q) Dossier",
        description: "Compiling monthly hydraulic totals, inlet vs outlet removal efficiencies, power consumption (kWh/m³), and presenting executive executive summaries to client management.",
        videoDurationMinutes: 1,
        competencyAreaId: "ca-onm-report",
        readingContent:
          "The monthly WQ&Q report is submitted to the client's plant head on the 3rd of every month. Key performance indicators include: % COD/BOD/TSS removal efficiency, total chemical spend vs budget, specific power consumption (kWh/kL treated), and equipment downtime tracking.",
        microQuiz: {
          id: "mq-onm-501-2",
          abilityId: "ab-onm-501-2",
          passThreshold: 70,
          questions: [
            {
              id: "q-onm-501-2",
              text: "What KPI represents the energy efficiency index in a monthly Nectar O&M report?",
              options: [
                { id: "opt-a", text: "Specific Energy Consumption: kWh per m³ (or kL) of treated water" },
                { id: "opt-b", text: "Total number of light bulbs" },
                { id: "opt-c", text: "Voltage of the battery" },
                { id: "opt-d", text: "Length of the electrical cables" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-onm-501",
        text: "How should a deputed Nectar shift lead handle an unexplained surge in client factory effluent flow exceeding design hydraulic capacity?",
        options: [
          { id: "opt-a", text: "Log exact time and surge volume, alert client environmental coordinator immediately, and divert excess to emergency equalization storage" },
          { id: "opt-b", text: "Open bypass valve to the municipal storm drain" },
          { id: "opt-c", text: "Turn off all inlet flow meters" },
          { id: "opt-d", text: "Go home early" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-onm-501",
        text: "Explain why routine weekly visits by Nectar Senior Process Experts are scheduled for client O&M sites:",
        options: [
          { id: "opt-a", text: "Provides rigorous technical auditing, verifies preventive maintenance compliance, conducts microscopic biomass checks, and mentors site operators" },
          { id: "opt-b", text: "To deliver snacks" },
          { id: "opt-c", text: "Only to collect bills" },
          { id: "opt-d", text: "To replace client security guards" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },
  {
    id: "course-onm-502",
    title: "Preventive Maintenance (PM) Schedules: Pumps, Blowers & Valves",
    code: "ONM-502",
    section: "Operation and Maintenance (O&M)",
    jobCategoryId: "jc-onm-lead",
    description:
      "Systematic PM schedules: positive displacement blower oil changes, vibration and infrared thermal checks, mechanical seal inspection, and actuated valve grease servicing.",
    thumbnailUrl: "/courses/preventive_maintenance.jpg",
    estimatedHours: 4.0,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-onm-502-1",
        courseId: "course-onm-502",
        order: 1,
        code: "2.1",
        title: "Blower & Pump Weekly Vibration, Temp & Gland Packing Check",
        description: "Using handheld vibration meters (RMS mm/s), infrared thermal thermometer gun (< 75°C bearing), and adjusting pump gland packing drips (20-30 drops/min).",
        videoDurationMinutes: 2,
        competencyAreaId: "ca-onm-pm",
        readingContent:
          "Roots blowers require synthetic gear oil changes every 1,500 running hours. Vibration exceeding 4.5 mm/s RMS signals urgent impeller misalignment or bearing fatigue. Pump mechanical seals must be checked daily for barrier fluid level and flush flow.",
        microQuiz: {
          id: "mq-onm-502-1",
          abilityId: "ab-onm-502-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-onm-502-1",
              text: "Why must standard water pump gland packings have a continuous slow leakage of 20 to 30 drops per minute?",
              options: [
                { id: "opt-a", text: "The leakage provides essential lubrication and cooling to prevent packing scorch and shaft sleeve wear" },
                { id: "opt-b", text: "It indicates the pump is completely broken" },
                { id: "opt-c", text: "To wash the floor" },
                { id: "opt-d", text: "To aerate the water" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-onm-502",
        text: "What is the primary indicator that an air intake filter on an aeration blower is severely clogged?",
        options: [
          { id: "opt-a", text: "Differential pressure gauge (manometer) shows red vacuum (> 50 mbar) and motor draws higher current" },
          { id: "opt-b", text: "Blower turns backwards" },
          { id: "opt-c", text: "Air turns into steam" },
          { id: "opt-d", text: "Oil leaks onto the roof" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-onm-502",
        text: "Draft a typical 30-day preventive maintenance schedule for an industrial chemical dosing pump:",
        options: [
          { id: "opt-a", text: "Day 1: Clean suction foot valve & strainer; Day 7: Inspect diaphragm for pinholes; Day 15: Flush stroke adjustment gearbox; Day 30: Calibrate stroke % against graduated cylinder" },
          { id: "opt-b", text: "Never touch the pump until it catches fire" },
          { id: "opt-c", text: "Replace the entire pump every month" },
          { id: "opt-d", text: "Only check the color of the paint" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },
  {
    id: "course-saf-202",
    title: "Safe Workplace: Confined Space Entry & H2S Gas Rescue",
    code: "ONM-503",
    section: "Operation and Maintenance (O&M)",
    jobCategoryId: "jc-onm-lead",
    description:
      "Statutory safety protocols: deep sump and equalization tank entry, multi-gas atmospheric testing (H2S, CO, O2, LEL), tripod retrieval winches, and breathing apparatus.",
    thumbnailUrl: "/courses/confined_space.jpg",
    estimatedHours: 4.0,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-saf-202-1",
        courseId: "course-saf-202",
        order: 1,
        code: "3.1",
        title: "Atmospheric Testing, Gas Detectors & Forced Mechanical Ventilation",
        description: "Operating 4-gas digital monitor, measuring top-middle-bottom strata of wet wells, and running 2,000 CFM explosion-proof blowers for 30 min before entry.",
        videoDurationMinutes: 1,
        competencyAreaId: "ca-onm-pm",
        readingContent:
          "Hydrogen sulfide (H2S) is heavier than air and settles in deep sumps. H2S deadens the olfactory nerve above 100 ppm, causing instant paralysis and unconsciousness. Never enter a sump without a signed Confined Space Work Permit, continuous gas monitoring, and an external standby rescue observer.",
        microQuiz: {
          id: "mq-saf-202-1",
          abilityId: "ab-saf-202-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-saf-202-1",
              text: "What is the minimum safe oxygen concentration for confined space entry without Self-Contained Breathing Apparatus (SCBA)?",
              options: [
                { id: "opt-a", text: "19.5% to 23.5% Oxygen" },
                { id: "opt-b", text: "5.0% to 10.0%" },
                { id: "opt-c", text: "50% to 75%" },
                { id: "opt-d", text: "Zero oxygen" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-saf-202",
        text: "What is the single most common cause of fatalities in wastewater confined space accidents?",
        options: [
          { id: "opt-a", text: "Untrained co-workers entering toxic atmospheres without breathing gear in an unplanned attempt to rescue a fallen colleague" },
          { id: "opt-b", text: "Falling ladders" },
          { id: "opt-c", text: "High water pressure" },
          { id: "opt-d", text: "Cold weather" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-saf-202",
        text: "Explain the hierarchy of mandatory equipment before an operator descends into an empty biological clarifier sump:",
        options: [
          { id: "opt-a", text: "1. Confined Space Permit -> 2. Calibrated 4-gas detector -> 3. Positive pressure mechanical ventilation -> 4. Full-body harness with retrieval tripod winch -> 5. Dedicated trained standby observer outside" },
          { id: "opt-b", text: "Just a flashlight" },
          { id: "opt-c", text: "A bucket and spade" },
          { id: "opt-d", text: "Rubber boots only" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },
  {
    id: "course-saf-203",
    title: "Electrical Safety, Lockout / Tagout (LOTO) & Arc Flash",
    code: "ONM-504",
    section: "Operation and Maintenance (O&M)",
    jobCategoryId: "jc-onm-lead",
    description:
      "Zero Energy State isolation: MCC breaker padlocking, Danger tags, multi-meter voltage verification (Live-Dead-Live), Arc Flash PPE, and electrical pump servicing safety.",
    thumbnailUrl: "/courses/electrical_loto.jpg",
    estimatedHours: 3.5,
    passThreshold: 70,
    abilities: [
      {
        id: "ab-saf-203-1",
        courseId: "course-saf-203",
        order: 1,
        code: "4.1",
        title: "6-Step Zero Energy Isolation & Live-Dead-Live Testing SOP",
        description: "1. Notify -> 2. Shut down -> 3. Isolate breaker -> 4. Lock & Tag -> 5. Dissipate residual energy -> 6. Test with calibrated digital multimeter.",
        videoDurationMinutes: 2,
        competencyAreaId: "ca-onm-pm",
        readingContent:
          "Never assume a pump or blower is de-energized because an HMI screen or local push-button is switched off. You must personally open the MCC feeder breaker, insert your individual padlock, apply your photo danger tag, and verify zero voltage using the Live-Dead-Live voltmeter method.",
        microQuiz: {
          id: "mq-saf-203-1",
          abilityId: "ab-saf-203-1",
          passThreshold: 70,
          questions: [
            {
              id: "q-saf-203-1",
              text: "Under OSHA and Indian Electricity Rules, who possesses the key to remove a personal LOTO safety padlock?",
              options: [
                { id: "opt-a", text: "Only the specific authorized employee who applied the padlock" },
                { id: "opt-b", text: "Any supervisor with a crowbar" },
                { id: "opt-c", text: "The security guard" },
                { id: "opt-d", text: "The client receptionist" },
              ],
              correctOptionId: "opt-a",
            },
          ],
        },
      },
    ],
    skillMappingQuestions: [
      {
        id: "smq-saf-203",
        text: "What does the 'Live-Dead-Live' electrical testing procedure verify?",
        options: [
          { id: "opt-a", text: "Proves that the digital multimeter is operational on a known live source before and after measuring the isolated circuit" },
          { id: "opt-b", text: "Checks if the light bulb works" },
          { id: "opt-c", text: "Restarts the motor automatically" },
          { id: "opt-d", text: "Charges the operator's battery" },
        ],
        correctOptionId: "opt-a",
      },
    ],
    writtenTestQuestions: [
      {
        id: "wtq-saf-203",
        text: "Explain what residual stored energy must be dissipated before opening a high-pressure pump casing:",
        options: [
          { id: "opt-a", text: "Trapped hydraulic head pressure (vent bleed valves), electrical VFD capacitor banks, and hot thermal liquid cooling" },
          { id: "opt-b", text: "Sound vibrations in the room" },
          { id: "opt-c", text: "Lighting in the room" },
          { id: "opt-d", text: "No residual energy exists" },
        ],
        correctOptionId: "opt-a",
      },
    ],
  },
];

// Pre-seeded enrollments for realistic interactive demo
export const initialEnrollments: CourseEnrollment[] = [
  {
    id: "enr-asha-etp",
    employeeId: "e-etp-op1",
    courseId: "course-etp-101",
    status: "IN_PROGRESS",
    startedAt: "2026-09-22T09:00:00Z",
    abilityProgress: {
      "ab-1-1": {
        abilityId: "ab-1-1",
        videoWatchedPct: 100,
        videoComplete: true,
        readingAcknowledged: true,
        quizAttempts: 1,
        quizPassed: true,
        quizScorePct: 100,
        unlockedAt: "2026-09-22T09:00:00Z",
        completedAt: "2026-09-22T10:15:00Z",
      },
      "ab-1-2": {
        abilityId: "ab-1-2",
        videoWatchedPct: 100,
        videoComplete: true,
        readingAcknowledged: true,
        quizAttempts: 1,
        quizPassed: true,
        quizScorePct: 100,
        unlockedAt: "2026-09-22T10:15:00Z",
        completedAt: "2026-09-23T11:30:00Z",
      },
      "ab-1-3": {
        abilityId: "ab-1-3",
        videoWatchedPct: 65,
        videoComplete: false,
        readingAcknowledged: false,
        quizAttempts: 0,
        quizPassed: false,
        unlockedAt: "2026-09-23T11:30:00Z",
      },
    },
  },
  {
    id: "enr-asha-ro",
    employeeId: "e-etp-op1",
    courseId: "course-ops-301",
    status: "CERTIFIED",
    startedAt: "2026-08-10T09:00:00Z",
    completedAt: "2026-08-25T16:00:00Z",
    abilityProgress: {
      "ab-ro-1": {
        abilityId: "ab-ro-1",
        videoWatchedPct: 100,
        videoComplete: true,
        readingAcknowledged: true,
        quizAttempts: 1,
        quizPassed: true,
        quizScorePct: 100,
        unlockedAt: "2026-08-10T09:00:00Z",
        completedAt: "2026-08-15T10:00:00Z",
      },
      "ab-ro-2": {
        abilityId: "ab-ro-2",
        videoWatchedPct: 100,
        videoComplete: true,
        readingAcknowledged: true,
        quizAttempts: 1,
        quizPassed: true,
        quizScorePct: 100,
        unlockedAt: "2026-08-15T10:00:00Z",
        completedAt: "2026-08-22T15:00:00Z",
      },
    },
  },
];


export const initialSkillMappingResults: SkillMappingResult[] = [];
export const initialWrittenTestResults: WrittenTestResult[] = [];
export const initialPracticalTestResults: PracticalTestResult[] = [];
export const initialOralTestResults: OralTestResult[] = [];
export const initialLearningNeedRecords: LearningNeedRecord[] = [];
export const initialTrainingSessions: TrainingSession[] = [];

export const initialCertificates: Certificate[] = [
  {
    id: "cert-asha-ro",
    certificateNo: "NEIPL-WTP-RO-2026-0042",
    enrollmentId: "enr-asha-ro",
    employeeId: "e-etp-op1",
    employeeName: "Asha Patil",
    courseId: "course-ops-301",
    courseTitle: "Industrial RO Membrane Operations & CIP Descaling",
    overallPct: 94,
    skillMapPct: 92,
    writtenPct: 95,
    practicalPct: 94,
    oralPct: 95,
    issuedAt: "2026-08-25T16:00:00Z",
    managerSignatory: "Rajesh Kulkarni (WTP & High Purity Specialist)",
    verificationHash: "sha256-8f9d0c2e4a1b6d5e7c8a9f0b1c2d3e4f",
  },
];

export const mockCertificates: Certificate[] = initialCertificates;


export const mockRecommendations: CourseRecommendation[] = [
  {
    id: "rec-1",
    courseId: "course-etp-102",
    title: "Advanced Membrane Bio-Reactor (MBR) for Industrial Effluents",
    code: "ETP-102",
    category: "Effluent Treatment (ETP)",
    provider: "Nectar ETP Technology Group",
    thumbnailUrl: "/courses/aeration_blowers.jpg",
    rating: 4.9,
    reviewCount: 2340,
    level: "Advanced",
    durationHours: 4.0,
    matchScorePct: 98,
    badge: "Turnkey ETP Priority",
    badgeColor: "blue",
  },
  {
    id: "rec-2",
    courseId: "course-ops-301",
    title: "Industrial RO Membrane Operations & CIP Descaling",
    code: "WTP-201",
    category: "Water Treatment (WTP)",
    provider: "Nectar High Purity Academy",
    thumbnailUrl: "/courses/ro_membrane.jpg",
    rating: 4.8,
    reviewCount: 1950,
    level: "Advanced",
    durationHours: 4.5,
    matchScorePct: 95,
    badge: "High Purity WTP",
    badgeColor: "green",
  },
  {
    id: "rec-3",
    courseId: "course-stp-101",
    title: "Sequencing Batch Reactor (SBR) & Cyclic Batch Treatment",
    code: "STP-101",
    category: "Sewage Treatment (STP)",
    provider: "Nectar STP Engineering Group",
    thumbnailUrl: "/courses/sbr_reactor.jpg",
    rating: 4.9,
    reviewCount: 1820,
    level: "Intermediate",
    durationHours: 4.5,
    matchScorePct: 94,
    badge: "Turnkey STP",
    badgeColor: "cyan",
  },
  {
    id: "rec-4",
    courseId: "course-zld-301",
    title: "Multiple Effect Evaporator (MEE) & Steam Economy",
    code: "ZLD-301",
    category: "Zero Liquid Discharge (ZLD)",
    provider: "Nectar Thermal Systems Group",
    thumbnailUrl: "/courses/multiple_effect_evaporator.jpg",
    rating: 5.0,
    reviewCount: 1420,
    level: "Advanced",
    durationHours: 4.5,
    matchScorePct: 97,
    badge: "ZLD Thermal Priority",
    badgeColor: "volcano",
  },
  {
    id: "rec-5",
    courseId: "course-env-402",
    title: "On-Site Treatability Studies & Bench-Scale Evaluation",
    code: "ENV-402",
    category: "Environmental Consulting",
    provider: "Nectar Environmental R&D Lab",
    thumbnailUrl: "/courses/chemical_safety.jpg",
    rating: 4.9,
    reviewCount: 960,
    level: "Intermediate",
    durationHours: 4.0,
    matchScorePct: 93,
    badge: "Consulting & R&D",
    badgeColor: "purple",
  },
  {
    id: "rec-6",
    courseId: "course-onm-501",
    title: "Deputed Manpower Protocols & Monthly WQ&Q Reporting",
    code: "ONM-501",
    category: "Operation & Maintenance",
    provider: "Nectar O&M Services Division",
    thumbnailUrl: "/courses/preventive_maintenance.jpg",
    rating: 4.9,
    reviewCount: 3100,
    level: "Foundation",
    durationHours: 4.5,
    matchScorePct: 96,
    badge: "O&M Service Standard",
    badgeColor: "gold",
  },
  {
    id: "rec-7",
    courseId: "course-stp-103",
    title: "Custom Skid-Mounted Packaged STPs for Small Footprint",
    code: "STP-103",
    category: "Sewage Treatment (STP)",
    provider: "Nectar Modular Skid Division",
    thumbnailUrl: "/courses/skid_stp.jpg",
    rating: 4.8,
    reviewCount: 880,
    level: "Foundation",
    durationHours: 3.5,
    matchScorePct: 91,
    badge: "Compact STP Tech",
    badgeColor: "blue",
  },
  {
    id: "rec-8",
    courseId: "course-qac-401",
    title: "Comprehensive Industrial Water Audits & Mass Balance",
    code: "ENV-401",
    category: "Environmental Consulting",
    provider: "Nectar Technical Directorate",
    thumbnailUrl: "/courses/water_lab_testing.jpg",
    rating: 4.9,
    reviewCount: 1540,
    level: "Advanced",
    durationHours: 4.5,
    matchScorePct: 92,
    badge: "Water Audit Certified",
    badgeColor: "magenta",
  },
];

export const mockMentors: MentorProfile[] = [
  {
    id: "mentor-sanjay",
    name: "Sanjay Jadhav",
    role: "ETP & Industrial Wastewater Lead",
    department: "Turnkey ETP Operations (ASP, MBBR, MBR)",
    photoUrl: "/mentors/mentor_sanjay.jpg",
    specialty: "Industrial MBR Membrane Scour, SVI Control & Coagulant Dosing",
    nextSlot: "Tomorrow, 10:30 AM",
    rating: 4.9,
    sessionCount: 48,
    availableDays: ["Mon", "Wed", "Fri"],
    publishedClinics: [
      {
        id: "cl-1",
        topic: "Industrial MBR Flux Recovery & Chemical In-Situ Cleaning",
        dayTime: "Tomorrow, 10:30 AM – 11:30 AM",
        location: "ETP Control Room & Membrane Cassette Bay",
        capacity: 6,
        registeredCount: 3,
      },
      {
        id: "cl-2",
        topic: "Secondary Clarifier Sludge Bulking & DO Tuning",
        dayTime: "Friday, 03:00 PM – 04:00 PM",
        location: "Biological Aeration Basin 2",
        capacity: 6,
        registeredCount: 1,
      },
    ],
  },
  {
    id: "mentor-rajesh",
    name: "Rajesh Kulkarni",
    role: "WTP & High Purity Systems Specialist",
    department: "Water Treatment Plants (RO, UF, EDI)",
    photoUrl: "/mentors/mentor_rajesh.jpg",
    specialty: "Industrial RO Scaling Prevention, Silt Density Index (SDI) & CIP Descaling",
    nextSlot: "Thursday, 02:00 PM",
    rating: 5.0,
    sessionCount: 72,
    availableDays: ["Tue", "Thu"],
    publishedClinics: [
      {
        id: "cl-3",
        topic: "RO Membrane Autopsy & Automated Acid/Alkali CIP Flush",
        dayTime: "Thursday, 02:00 PM – 03:15 PM",
        location: "WTP Membrane Gallery",
        capacity: 8,
        registeredCount: 5,
      },
      {
        id: "cl-4",
        topic: "Hollow-Fiber Ultrafiltration (UF) TMP Diagnostics",
        dayTime: "Next Tuesday, 11:00 AM – 12:00 PM",
        location: "High Purity Utility Bay",
        capacity: 8,
        registeredCount: 2,
      },
    ],
  },
  {
    id: "mentor-meera",
    name: "Dr. Meera Kulkarni",
    role: "Environmental Consulting & Laboratory Lead",
    department: "Environmental Auditing & Treatability Services",
    photoUrl: "/mentors/mentor_meera.jpg",
    specialty: "Industrial Water Audits, Treatability Studies & CTE/CTO Consents",
    nextSlot: "Friday, 09:30 AM",
    rating: 4.9,
    sessionCount: 39,
    availableDays: ["Wed", "Fri", "Sat"],
    publishedClinics: [
      {
        id: "cl-5",
        topic: "Effluent Treatability Screening: Jar Testing & Refractory COD Destruction",
        dayTime: "Friday, 09:30 AM – 10:45 AM",
        location: "Central Analytical Laboratory",
        capacity: 5,
        registeredCount: 3,
      },
      {
        id: "cl-6",
        topic: "Comprehensive Plant Water Balance Audit & Mass Flow Accounting",
        dayTime: "Saturday, 11:30 AM – 12:30 PM",
        location: "Conference Room A",
        capacity: 5,
        registeredCount: 0,
      },
    ],
  },
  {
    id: "mentor-vikram",
    name: "Vikram Patil",
    role: "Plant O&M & ZLD Thermal Systems Head",
    department: "Operation & Maintenance (O&M) & ZLD",
    photoUrl: "/mentors/mentor_vikram.jpg",
    specialty: "Multiple Effect Evaporators (MEE), ATFD Maintenance & Safety Protocols",
    nextSlot: "Saturday, 11:00 AM",
    rating: 4.8,
    sessionCount: 56,
    availableDays: ["Mon", "Tue", "Sat"],
    publishedClinics: [
      {
        id: "cl-7",
        topic: "Multiple Effect Evaporator (MEE) Boiling Tube Descaling & Steam Economy",
        dayTime: "Saturday, 11:00 AM – 12:15 PM",
        location: "ZLD Evaporator Deck",
        capacity: 8,
        registeredCount: 4,
      },
      {
        id: "cl-8",
        topic: "Confined Space Deep Sump Entry (H2S Clearances) & LOTO Drills",
        dayTime: "Monday, 08:30 AM – 09:30 AM",
        location: "Safety Staging Area",
        capacity: 8,
        registeredCount: 2,
      },
    ],
  },
];

export const mockSpecializationTracks: SpecializationTrack[] = [
  {
    id: "track-etp-specialist",
    title: "Industrial Effluent & Biological Wastewater Treatment Specialization",
    slug: "etp-biological-treatment",
    subtitle: "Master biological nutrient removal, MBR ultrafiltration, chemical coagulation stoichiometry, and filter press dewatering across high-volume chemical and pharmaceutical plants.",
    heroBadge: "Nectar Industrial Wastewater Operations Professional Credential",
    category: "Effluent Treatment Plants (ETP)",
    provider: "Nectar Operations Academy",
    partnerLogoText: "NEIPL ACADEMY",
    partnerLogoBg: "#0B1A24",
    rating: 4.9,
    reviewCount: 418,
    enrolledCount: 2420,
    durationWeeks: 6,
    hoursPerWeek: 4,
    level: "Intermediate",
    language: "English & Hindi (Site Technical Terms)",
    bannerImage: "/courses/aeration_blowers.jpg",
    leadMentorId: "mentor-sanjay",
    skillsGained: [
      "Biological Wastewater Treatment",
      "MBR Ultrafiltration",
      "Jar Testing & Coagulation",
      "Sludge Dewatering (Plate Press)",
      "F/M & SVI Control",
      "CPCB OCEMS Telemetry"
    ],
    whatYouWillLearn: [
      {
        title: "Effluent Stoichiometry & Biological Mass Balance",
        description: "Calculate Food-to-Microorganism (F/M) ratios, target Mixed Liquor Suspended Solids (MLSS 3,500 - 5,000 mg/L), and coagulant dosing tolerances for shock organic loads."
      },
      {
        title: "Membrane Bioreactor (MBR) Skid Diagnostics",
        description: "Manage hollow-fiber and flat-sheet MBR skids, monitor transmembrane pressure (TMP), and execute sodium hypochlorite Clean-In-Place (CIP) recovery cycles."
      },
      {
        title: "Sludge Conditioning & Multi-Plate Filter Press",
        description: "Optimize cationic polyacrylamide dosing, manage screw feed pressures up to 14 bar, and consistently achieve >28% dry cake solids."
      },
      {
        title: "Automated Jar Testing & OCEMS Compliance",
        description: "Perform 6-station jar tests to determine optimal polyaluminum chloride (PAC) ppm and ensure 24/7 compliance with state and central pollution control boards."
      }
    ],
    courseIds: [
      "course-etp-101",
      "course-etp-102",
      "course-slu-104",
      "course-qac-402"
    ],
    appliedLearningProject: {
      title: "300 KLD Pharmaceutical ETP Secondary Clarifier Shock Load Remediation",
      facilityType: "Active API Pharmaceutical Facility (Tarapur MIDC)",
      description: "Learners analyze real-world SCADA trends from a 300 KLD bulk active pharmaceutical plant encountering sudden filamentous sludge bulking and rising turbidity. You will diagnose SVI > 200 ml/g, adjust return activated sludge (RAS) ratios, dose coagulant aids, and restore effluent COD under 250 mg/L within a simulated 48-hour turn-around.",
      keyDeliverables: [
        "Hydraulic retention time (HRT) & biomass mass balance calculation sheet",
        "Chemical dosing correction log for rapid flock stabilization",
        "Standard operating procedure incident remediation report",
        "Senior plant manager viva voce presentation"
      ]
    },
    recommendedTrackIds: [
      "track-zld-lead",
      "track-wtp-ro",
      "track-om-manager"
    ]
  },
  {
    id: "track-wtp-ro",
    title: "High-Purity Water Treatment & RO Desalination Specialization",
    slug: "wtp-ro-desalination",
    subtitle: "Design, commission, and troubleshoot industrial multi-stage reverse osmosis trains, ultrafiltration pre-treatment, and electro-deionization (EDI) systems.",
    heroBadge: "Nectar High-Purity Process Water Qualification",
    category: "Water Treatment Plants (WTP)",
    provider: "Nectar Operations Academy",
    partnerLogoText: "NEIPL ACADEMY",
    partnerLogoBg: "#0F2E47",
    rating: 4.8,
    reviewCount: 326,
    enrolledCount: 1890,
    durationWeeks: 6,
    hoursPerWeek: 4,
    level: "Intermediate",
    language: "English & Hindi (Site Technical Terms)",
    bannerImage: "/courses/water_lab_testing.jpg",
    leadMentorId: "mentor-rajesh",
    skillsGained: [
      "Reverse Osmosis (RO)",
      "Ultrafiltration (UF)",
      "EDI Demineralization",
      "High Pressure Pumps & VFDs",
      "Silt Density Index (SDI)",
      "Membrane CIP Descaling"
    ],
    whatYouWillLearn: [
      {
        title: "RO Membrane Salt Rejection & Flux Calculations",
        description: "Calculate recovery percentages, salt rejection rates (>99.2%), and normalized permeate flux across 2-stage RO arrays."
      },
      {
        title: "Ultrafiltration Integrity & Silt Density Index (SDI)",
        description: "Perform pressure decay tests, backwash flux recovery, and maintain feedwater SDI < 3.0 to protect downstream membranes."
      },
      {
        title: "Dual Media & Electro-Deionization (EDI) Polish",
        description: "Operate continuous resin regeneration EDI modules to produce ultra-pure process water (< 0.1 µS/cm conductivity)."
      },
      {
        title: "High-Pressure Booster Pumps & VFD Control",
        description: "Balance pump hydraulic performance curves, prevent water hammer cavitation, and optimize energy efficiency with VFD tuning."
      }
    ],
    courseIds: [
      "course-ops-301",
      "course-ops-304",
      "course-ops-303",
      "course-ops-302"
    ],
    appliedLearningProject: {
      title: "500 m³/day Industrial WTP Membrane Fouling Autopsy & Recovery Protocol",
      facilityType: "Automotive Precision Manufacturing Plant (Chakan MIDC)",
      description: "Conduct a full differential pressure diagnosis on a 2-pass reverse osmosis skid exhibiting 25% permeate flow drop. Determine whether silica scaling, bio-fouling, or colloidal silt caused the decline, formulate a targeted two-step alkaline and acid CIP sequence, and verify post-cleaning flux restoration.",
      keyDeliverables: [
        "Normalized permeate flux trend report",
        "Acid/alkali chemical cleaning matrix and safety clearance",
        "Membrane life extension SOP",
        "Plant commissioning checklist"
      ]
    },
    recommendedTrackIds: [
      "track-etp-specialist",
      "track-zld-lead",
      "track-om-manager"
    ]
  },
  {
    id: "track-zld-lead",
    title: "Zero Liquid Discharge (ZLD) Thermal Recovery & Crystallization Specialization",
    slug: "zld-thermal-crystallization",
    subtitle: "Achieve complete zero effluent liquid discharge through multi-effect evaporation (MEE), mechanical vapor recompression (MVR), and agitated thin film dryers (ATFD).",
    heroBadge: "Industrial ZLD Thermal Systems Master Specialist",
    category: "Zero Liquid Discharge (ZLD)",
    provider: "Nectar Operations Academy",
    partnerLogoText: "NEIPL ACADEMY",
    partnerLogoBg: "#1C4463",
    rating: 4.9,
    reviewCount: 284,
    enrolledCount: 1450,
    durationWeeks: 5,
    hoursPerWeek: 5,
    level: "Advanced",
    language: "English & Hindi (Site Technical Terms)",
    bannerImage: "/courses/sludge_press.jpg",
    leadMentorId: "mentor-vikram",
    skillsGained: [
      "ZLD Thermal Evaporation",
      "MEE Steam Economy",
      "ATFD Salt Crystallizers",
      "Brine Concentration RO",
      "Vacuum Systems & Calandrias",
      "Thermal Mass Balance"
    ],
    whatYouWillLearn: [
      {
        title: "Multi-Effect Evaporator (MEE) Steam Economy",
        description: "Balance enthalpy heat transfer, maintain vacuum levels (-0.85 bar), and optimize steam consumption per cubic meter of condensate."
      },
      {
        title: "Agitated Thin Film Dryer (ATFD) Salt Recovery",
        description: "Manage high-speed rotor blade clearances, control thermal jacket steam pressures, and discharge high-purity crystalline sodium salts."
      },
      {
        title: "High Recovery Brine Concentration RO",
        description: "Operate high-pressure spiral wound membranes at up to 80 bar to concentrate reject brine prior to thermal evaporation."
      },
      {
        title: "Boiling Tube Descaling & Scale Inhibitor Dosing",
        description: "Implement online antiscalant dosing regimens to prevent calcium sulfate scaling on titanium heating tubes."
      }
    ],
    courseIds: [
      "course-zld-301",
      "course-zld-302",
      "course-zld-303"
    ],
    appliedLearningProject: {
      title: "Textile Dyeing Complex 200 KLD ZLD Energy Audit & Crystallizer Balancing",
      facilityType: "Integrated Textile & Dyeing Industrial Cluster (Surat GIDC)",
      description: "Analyze severe scale formation on 2nd-effect calandria tubes causing 40% loss in vacuum and excessive live steam consumption. Develop an updated thermal mass balance model, schedule mechanical descaling, and reconfigure liquor circulation to yield reusable sodium sulfate salt.",
      keyDeliverables: [
        "Steam economy heat balance audit",
        "Descaling chemistry safety clearance",
        "Recovered salt purity laboratory certificate",
        "Zero discharge statutory compliance verification"
      ]
    },
    recommendedTrackIds: [
      "track-etp-specialist",
      "track-om-manager",
      "track-wtp-ro"
    ]
  },
  {
    id: "track-om-manager",
    title: "Industrial Plant Operation, Preventive Maintenance & Compliance Specialization",
    slug: "om-plant-maintenance-compliance",
    subtitle: "Lead multi-shift plant teams, implement predictive maintenance schedules, manage hazardous waste manifests, and enforce zero-incident LOTO and safety protocols.",
    heroBadge: "Plant Operation & Maintenance Manager Credential",
    category: "Operation and Maintenance (O&M)",
    provider: "Nectar Operations Academy",
    partnerLogoText: "NEIPL ACADEMY",
    partnerLogoBg: "#16364F",
    rating: 4.9,
    reviewCount: 512,
    enrolledCount: 3100,
    durationWeeks: 6,
    hoursPerWeek: 4,
    level: "Advanced",
    language: "English & Hindi (Site Technical Terms)",
    bannerImage: "/courses/confined_space.jpg",
    leadMentorId: "mentor-meera",
    skillsGained: [
      "Plant Shift Leadership",
      "Preventive Maintenance (PM)",
      "LOTO Isolation Protocols",
      "Confined Space Gas Rescue",
      "Monthly WQ&Q SLA Reporting",
      "Statutory CPCB Consents"
    ],
    whatYouWillLearn: [
      {
        title: "Daily & Monthly WQ&Q SLA Compliance Reporting",
        description: "Compile standard Water Quality & Quantity (WQ&Q) logs, calculate plant availability metrics (>98.5%), and satisfy client contract SLAs."
      },
      {
        title: "Preventive Maintenance Scheduling (Pumps & Blowers)",
        description: "Establish vibration analysis, bearing lubrication schedules, impeller clearance checks, and seal flushing for heavy-duty slurry pumps."
      },
      {
        title: "Confined Space Entry & H2S Emergency Protocols",
        description: "Master multi-gas atmospheric testing, forced air ventilation requirements, harness rescue tripods, and Form 10 permits."
      },
      {
        title: "Lockout / Tagout (LOTO) & Electrical Arc Safety",
        description: "Execute 7-step LOTO isolation on 415V motor control centers (MCC), de-energization zero-energy verification, and arc flash PPE."
      }
    ],
    courseIds: [
      "course-onm-501",
      "course-onm-502",
      "course-saf-202",
      "course-saf-203"
    ],
    appliedLearningProject: {
      title: "Turnaround Overhaul & Statutory Safety Audit of a 1.2 MLD Combined Plant",
      facilityType: "Specialty Chemicals Manufacturing Hub (Dahej PCPIR)",
      description: "Coordinate a 72-hour comprehensive maintenance shutdown across 12 unit operations. Prepare LOTO staging plans, issue hot work and confined space permits for equalization tank inspection, overhaul 4 aeration blowers, and submit the statutory compliance report to regulatory authorities.",
      keyDeliverables: [
        "Master 72-hour Gantt chart overhaul schedule",
        "Integrated LOTO permit staging matrix",
        "Incident prevention risk assessment",
        "Client handover certification signoff"
      ]
    },
    recommendedTrackIds: [
      "track-etp-specialist",
      "track-zld-lead",
      "track-wtp-ro"
    ]
  }
];

export const mockRoleTracks: RoleProgressionTrack[] = [];

export interface NectarOralQuestion {
  sNo: number;
  section: string;
  question: string;
  maxMarks: number;
}

export const NECTAR_ORAL_VIVA_QUESTIONS: NectarOralQuestion[] = [
  { sNo: 1, section: "Basic Knowledge", question: "Explain overall plant process (ETP/RO/MEE)", maxMarks: 5 },
  { sNo: 2, section: "Basic Knowledge", question: "Why water treatment is required?", maxMarks: 5 },
  { sNo: 3, section: "Basic Knowledge", question: "Difference between RO, ETP and MEE?", maxMarks: 5 },
  { sNo: 4, section: "Process", question: "Explain complete plant process flow", maxMarks: 5 },
  { sNo: 5, section: "Process", question: "Role of pre-treatment systems", maxMarks: 5 },
  { sNo: 6, section: "Process", question: "Role of high-pressure pumps/blowers", maxMarks: 5 },
  { sNo: 7, section: "Chemical", question: "Purpose of chemicals used (Alum, Antiscalant etc.)", maxMarks: 5 },
  { sNo: 8, section: "Chemical", question: "Purpose of SMBS / dosing control", maxMarks: 5 },
  { sNo: 9, section: "Biological", question: "What is biofouling / biological treatment?", maxMarks: 5 },
  { sNo: 10, section: "Monitoring", question: "What parameters are monitored daily?", maxMarks: 5 },
  { sNo: 11, section: "Troubleshooting", question: "Action for low flow / plant upset", maxMarks: 5 },
  { sNo: 12, section: "Troubleshooting", question: "Action for high TDS / COD/BOD", maxMarks: 5 },
  { sNo: 13, section: "Equipment", question: "Function of major equipment", maxMarks: 5 },
  { sNo: 14, section: "Equipment", question: "Maintenance practices", maxMarks: 5 },
  { sNo: 15, section: "Safety", question: "Required PPE and safety practices", maxMarks: 5 },
  { sNo: 16, section: "Monitoring", question: "Importance of log sheet & reporting", maxMarks: 5 },
  { sNo: 17, section: "Practical", question: "How to prepare chemical solution", maxMarks: 5 },
  { sNo: 18, section: "Practical", question: "How to start/stop plant systems", maxMarks: 5 },
  { sNo: 19, section: "Site Based", question: "Common issues at site and actions", maxMarks: 5 },
  { sNo: 20, section: "Overall Skill", question: "Leadership and decision making", maxMarks: 5 },
];

export interface NectarLniItem {
  sNo: number;
  section: string;
  competencyArea: string;
  defaultLevel: "LOW" | "MED" | "HIGH";
  trainingRequired: "Yes" | "No";
  recommendedCourseId?: string;
}

export const NECTAR_LNI_COMPETENCIES: NectarLniItem[] = [
  { sNo: 1, section: "Basic Knowledge", competencyArea: "Understanding of ETP, RO & MEE processes", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-etp-101" },
  { sNo: 2, section: "Basic Knowledge", competencyArea: "Knowledge of plant components & systems", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-etp-101" },
  { sNo: 3, section: "Process", competencyArea: "Pre-treatment and overall process flow", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-etp-101" },
  { sNo: 4, section: "Process", competencyArea: "System operation and integration (ETP+RO+MEE)", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-onm-501" },
  { sNo: 5, section: "Chemical", competencyArea: "Chemical dosing and control", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-wtp-301" },
  { sNo: 6, section: "Chemical", competencyArea: "Antiscalant, SMBS & chemical handling", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-wtp-301" },
  { sNo: 7, section: "Biological", competencyArea: "Biological treatment & biofouling understanding", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-etp-101" },
  { sNo: 8, section: "Monitoring", competencyArea: "Parameter monitoring (pH, TDS, COD, flow)", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-etp-101" },
  { sNo: 9, section: "Troubleshooting", competencyArea: "Handling low flow / plant upset", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-etp-102" },
  { sNo: 10, section: "Troubleshooting", competencyArea: "Handling high TDS / COD/BOD issues", defaultLevel: "LOW", trainingRequired: "Yes", recommendedCourseId: "course-etp-102" },
  { sNo: 11, section: "Equipment", competencyArea: "Pump, blower, membrane & equipment knowledge", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-onm-501" },
  { sNo: 12, section: "Equipment", competencyArea: "Filter, evaporator & maintenance knowledge", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-mee-401" },
  { sNo: 13, section: "Safety", competencyArea: "PPE and safety compliance", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-saf-201" },
  { sNo: 14, section: "Practical", competencyArea: "Start/Stop procedures for all systems", defaultLevel: "HIGH", trainingRequired: "No" },
  { sNo: 15, section: "Practical", competencyArea: "Chemical preparation and dosing", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-wtp-301" },
  { sNo: 16, section: "Maintenance", competencyArea: "CIP and preventive maintenance", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-onm-502" },
  { sNo: 17, section: "Maintenance", competencyArea: "Membrane & equipment handling", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-wtp-302" },
  { sNo: 18, section: "Documentation", competencyArea: "Log sheet & reporting management", defaultLevel: "HIGH", trainingRequired: "No" },
  { sNo: 19, section: "Housekeeping", competencyArea: "Plant cleanliness & discipline", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-saf-201" },
  { sNo: 20, section: "Overall", competencyArea: "Leadership, decision making & system understanding", defaultLevel: "MED", trainingRequired: "Yes", recommendedCourseId: "course-onm-501" },
];

