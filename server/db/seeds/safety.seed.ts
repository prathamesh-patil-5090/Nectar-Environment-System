/**
 * Safety reference data: baseline emergency protocols + the Safety In-Charge person record.
 * No incidents are seeded — the safety log only holds real reports.
 * Protocol text is a starting point for the Safety In-Charge to edit in /safety/protocols.
 */

const NATIONAL_CONTACTS = [
  { label: 'Emergency (all services)', phone: '112' },
  { label: 'Ambulance', phone: '108' },
  { label: 'Fire brigade', phone: '101' },
];

const updatedAtIso = '2026-10-03T00:00:00.000Z';

export const safetyProtocolsSeed = [
  {
    id: 'sp-fire',
    title: 'Fire or smoke',
    category: 'fire',
    summary: 'Raise the alarm, evacuate, fight only small fires with the right extinguisher.',
    steps: [
      'Shout "FIRE" and press the nearest alarm / inform the shift in-charge.',
      'Isolate power to the affected panel or equipment if it is safe to do so.',
      'Use a CO2 extinguisher on electrical fires; never use water on live equipment.',
      'If the fire is not out within 30 seconds, leave and close doors behind you.',
      'Assemble at the site assembly point; shift in-charge takes a head count.',
      'Report the event in Safety → Report as an incident, with photos once safe.',
    ],
    emergencyContacts: NATIONAL_CONTACTS,
    siteIds: [],
  },
  {
    id: 'sp-chemical',
    title: 'Chemical spill or exposure',
    category: 'chemical',
    summary: 'Keep people away, protect yourself, contain the spill, wash exposed skin/eyes for 15 minutes.',
    steps: [
      'Stop work and warn everyone nearby; keep upwind of the spill.',
      'Wear gloves, goggles and apron before going near the spill.',
      'Close the valve / stop the dosing pump if it can be done safely.',
      'Contain with sand or spill kit; do not wash acids or caustic into drains.',
      'Skin or eye contact: rinse with clean running water for at least 15 minutes, remove contaminated clothing.',
      'Take the chemical name (label / MSDS) to the clinic with the injured person.',
    ],
    emergencyContacts: NATIONAL_CONTACTS,
    siteIds: [],
  },
  {
    id: 'sp-open-tank',
    title: 'Open tank, pit or manhole',
    category: 'fall',
    summary: 'Every open cover must be barricaded and signed before work starts.',
    steps: [
      'Never leave a tank cap, pit or manhole open without a barricade and sign board.',
      'If you see an uncovered opening, stop anyone walking towards it and stand guard.',
      'Inform the shift in-charge and report it as a near-miss in Safety → Report.',
      'Do not enter tanks or pits without a confined-space permit, gas test and standby person.',
    ],
    emergencyContacts: NATIONAL_CONTACTS,
    siteIds: [],
  },
  {
    id: 'sp-electrical',
    title: 'Electric shock',
    category: 'electrical',
    summary: 'Cut the power first — never touch a person who is still in contact with a live source.',
    steps: [
      'Switch off the supply at the panel or pull the plug.',
      'If power cannot be cut, push the person away with dry wood or plastic.',
      'Check breathing; start CPR if trained and the person is not breathing.',
      'Call an ambulance even if the person seems fine — shocks can cause delayed heart problems.',
      'Lock out and tag the equipment until it has been inspected.',
    ],
    emergencyContacts: NATIONAL_CONTACTS,
    siteIds: [],
  },
  {
    id: 'sp-first-aid',
    title: 'Injury and first aid',
    category: 'first_aid',
    summary: 'Make the area safe, give first aid, record every injury however small.',
    steps: [
      'Make the area safe before helping.',
      'Give first aid from the site first-aid box; do not move a person with a suspected spine injury.',
      'Call an ambulance for heavy bleeding, burns, head injury, unconsciousness or breathing difficulty.',
      'Inform the plant manager and Safety In-charge immediately.',
      'Report it in Safety → Report as an incident so return-to-work clearance is tracked.',
    ],
    emergencyContacts: NATIONAL_CONTACTS,
    siteIds: [],
  },
  {
    id: 'sp-gas',
    title: 'Gas leak (H2S / chlorine)',
    category: 'chemical',
    summary: 'Evacuate upwind, never enter to rescue without breathing apparatus.',
    steps: [
      'Warn others and move upwind / to higher ground.',
      'Do not enter the area to rescue anyone without breathing apparatus.',
      'Isolate the source only if it can be done from a safe place.',
      'Ventilate and gas-test before anyone re-enters.',
    ],
    emergencyContacts: NATIONAL_CONTACTS,
    siteIds: [],
  },
].map((p) => ({ ...p, version: 1, updatedBy: 'Safety In-Charge', updatedAtIso }));

/** Org-wide login without an employee row — same id the client derives: "user:<login email>". */
export const safetyLeadersSeed = [
  {
    id: 'user:safety@nectarenviro.com',
    name: 'Safety In-Charge',
    role: 'safety_incharge',
    title: 'Safety In-Charge',
    email: 'safety@nectarenviro.com',
    active: true,
  },
];
