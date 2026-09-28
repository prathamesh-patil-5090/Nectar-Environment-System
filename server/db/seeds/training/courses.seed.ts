export const coursesSeed = [
  {
    id: 'course-etp-101',
    courseId: 'course-etp-101',
    title: 'ETP Biological & Chemical Treatment Operations',
    code: 'ETP-101',
    section: 'Effluent Treatment Plants (ETP)',
    jobCategoryId: 'jc-etp-op',
    description:
      'Comprehensive industrial effluent operations: equalization air sparging, coagulant jar testing, primary settling, aerobic biological flocs, and clarifier sludge recycling.',
    thumbnailUrl: '/courses/etp_plant.jpg',
    estimatedHours: 4.5,
    passThreshold: 70,
    abilities: [
      {
        id: 'ab-1-1',
        courseId: 'course-etp-101',
        order: 1,
        code: '1.1',
        title: 'Process Flow & Design Hydraulic Retention Time (HRT)',
        description:
          'Understanding plant inlet screening, equalization tank buffer volume, and peak flow shock load absorption.',
        videoDurationMinutes: 1,
        competencyAreaId: 'ca-etp-bio',
      },
      {
        id: 'ab-1-2',
        courseId: 'course-etp-101',
        order: 2,
        code: '1.2',
        title: 'Coagulation & Jar Test Chemical Dosage',
        description:
          'Bench-scale jar testing to optimize alum, lime, and polyelectrolyte dosing for varying influent turbidity.',
        videoDurationMinutes: 1,
        competencyAreaId: 'ca-etp-chem',
      },
      {
        id: 'ab-1-3',
        courseId: 'course-etp-101',
        order: 3,
        code: '1.3',
        title: 'Aeration Basin DO & Mixed Liquor Suspended Solids (MLSS)',
        description:
          'Maintaining active biomass health, dissolved oxygen between 2.0-3.0 mg/L, and Food-to-Microorganism (F/M) balance.',
        videoDurationMinutes: 1,
        competencyAreaId: 'ca-etp-bio',
      },
    ],
  },
  {
    id: 'course-ops-301',
    courseId: 'course-ops-301',
    title: 'Industrial RO Membrane Operations & CIP Descaling',
    code: 'RO-301',
    section: 'Water Treatment Plants (WTP)',
    jobCategoryId: 'jc-wtp-tech',
    description:
      'Standard operating procedures for spiral-wound thin film composite RO membranes: SDI index monitoring, antiscalant dosing stoichiometry, salt rejection normalization, and two-stage chemical CIP.',
    thumbnailUrl: '/courses/ro_plant.jpg',
    estimatedHours: 5.0,
    passThreshold: 75,
    abilities: [
      {
        id: 'ab-ro-1',
        courseId: 'course-ops-301',
        order: 1,
        code: '1.1',
        title: 'Silt Density Index (SDI) & Pre-treatment Cartridge Filter Delta-P',
        description:
          'SDI15 measurement protocol using 0.45 micron filter pads at 30 psi feed pressure.',
        videoDurationMinutes: 1,
        competencyAreaId: 'ca-wtp-ro',
      },
      {
        id: 'ab-ro-2',
        courseId: 'course-ops-301',
        order: 2,
        code: '1.2',
        title: 'High-Pressure Pump Start-up Sequencing & Water Hammer Prevention',
        description:
          'Automatic soft-start ramp rate, concentrate control valve positioning, and slow pressurized filling.',
        videoDurationMinutes: 1,
        competencyAreaId: 'ca-wtp-ro',
      },
    ],
  },
  {
    id: 'course-zld-401',
    courseId: 'course-zld-401',
    title: 'Thermal Evaporation Systems: MEE & ATFD Operation',
    code: 'MEE-401',
    section: 'Zero Liquid Discharge (ZLD)',
    jobCategoryId: 'jc-zld-eng',
    description:
      'Operation of falling-film and forced-circulation Multiple Effect Evaporators (MEE), barometric condenser vacuum systems, steam economy balancing, and Agitated Thin Film Dryer (ATFD) salt crystallization.',
    thumbnailUrl: '/courses/mee_plant.jpg',
    estimatedHours: 5.5,
    passThreshold: 75,
    abilities: [
      {
        id: 'ab-mee-1',
        courseId: 'course-zld-401',
        order: 1,
        code: '1.1',
        title: 'Thermo-Compressor Steam Jet Ejector & Vacuum Gradient Balancing',
        description:
          'Calibrating multi-stage steam ejectors and barometric seal legs to maintain inter-effect vacuum gradient.',
        videoDurationMinutes: 1,
        competencyAreaId: 'ca-zld-mee',
      },
    ],
  },
];
