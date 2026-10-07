/**
 * E-Permit masters — departments with a Head of Department (Senior Manager) and a deputy each,
 * seeded locations with their owner department, per-site emergency contacts, and the
 * HoD / deputy logins (the only copy — the client reads them via GET /auth/accounts).
 */

const P = 'nectar2026';
const ALL_SITES = ['s-etp', 's-ro', 's-mee'];

type Person = { email: string; name: string; title: string };

const dept = (id: string, name: string, head: Person, deputy: Person) => ({
  id,
  name,
  headUserId: `user:${head.email}`,
  headName: head.name,
  deputyUserIds: [`user:${deputy.email}`],
  deputyNames: [deputy.name],
  siteIds: ALL_SITES,
  head,
  deputy,
});

const DEPTS = [
  dept(
    'dept-operations',
    'Operations',
    { email: 'hod.operations@nectarenviro.com', name: 'Rajendra Kulkarni', title: 'Senior Manager — Operations' },
    { email: 'dy.operations@nectarenviro.com', name: 'Meera Joshi', title: 'Deputy — Operations' },
  ),
  dept(
    'dept-mechanical',
    'Mechanical',
    { email: 'hod.mechanical@nectarenviro.com', name: 'Suresh Gaikwad', title: 'Senior Manager — Mechanical' },
    { email: 'dy.mechanical@nectarenviro.com', name: 'Nitin Shinde', title: 'Deputy — Mechanical' },
  ),
  dept(
    'dept-electrical',
    'Electrical',
    { email: 'hod.electrical@nectarenviro.com', name: 'Vinod Deshmukh', title: 'Senior Manager — Electrical' },
    { email: 'dy.electrical@nectarenviro.com', name: 'Kiran Jadhav', title: 'Deputy — Electrical' },
  ),
  dept(
    'dept-chemical',
    'Chemical',
    { email: 'hod.chemical@nectarenviro.com', name: 'Archana Mehta', title: 'Senior Manager — Chemical' },
    { email: 'dy.chemical@nectarenviro.com', name: 'Prakash Naik', title: 'Deputy — Chemical' },
  ),
];

export const departmentsSeed = DEPTS.map(({ head: _h, deputy: _d, ...d }) => d);

/** Leaders rows — HoDs / deputies are not employees; id matches the client person id "user:<email>". */
export const hodLeadersSeed = DEPTS.flatMap((d) =>
  [d.head, d.deputy].map((p) => ({
    id: `user:${p.email}`,
    name: p.name,
    role: 'hod',
    title: p.title,
    email: p.email,
    active: true,
  })),
);

/** Login accounts (users collection). */
export const hodUsersSeed = DEPTS.flatMap((d) =>
  [d.head, d.deputy].map((p) => ({
    email: p.email,
    password: P,
    name: p.name,
    role: 'hod',
    visibleOnLogin: true,
    active: true,
  })),
);

const OPS = 'dept-operations';
const MECH = 'dept-mechanical';
const ELEC = 'dept-electrical';
const CHEM = 'dept-chemical';

/** `concerned` = the other departments that run equipment or people at the location; each clears every permit there. */
const loc = (id: string, siteId: string, name: string, ownerDepartmentId: string, tags: string[] = [], concerned: string[] = []) => ({
  id,
  siteId,
  name,
  ownerDepartmentId,
  tags,
  concernedDepartmentIds: concerned,
  active: true,
});

export const permitLocationsSeed = [
  // ETP — Thane
  loc('loc-etp-clarifier', 's-etp', 'ETP clarifier', OPS, [], [MECH, ELEC]),
  loc('loc-etp-aeration', 's-etp', 'Aeration tank', OPS, ['tank'], [MECH, ELEC, CHEM]),
  loc('loc-etp-dosing', 's-etp', 'Chemical dosing area', CHEM, ['chemical'], [OPS, MECH]),
  loc('loc-etp-mcc', 's-etp', 'MCC room', ELEC, ['electrical'], [OPS]),
  loc('loc-etp-workshop', 's-etp', 'Maintenance workshop', MECH, [], [ELEC]),
  // RO — Pune
  loc('loc-ro-skid', 's-ro', 'RO skid', OPS, [], [MECH, ELEC, CHEM]),
  loc('loc-ro-hpp', 's-ro', 'High-pressure pump area', MECH, [], [OPS, ELEC]),
  loc('loc-ro-cip', 's-ro', 'CIP / chemical cleaning area', CHEM, ['chemical'], [OPS, MECH]),
  loc('loc-ro-mcc', 's-ro', 'MCC room', ELEC, ['electrical'], [OPS]),
  // MEE — Vashi
  loc('loc-mee-bay', 's-mee', 'MEE evaporator bay', OPS, ['mee'], [MECH, ELEC]),
  loc('loc-mee-tankfarm', 's-mee', 'MEE tank farm', OPS, ['mee', 'tank'], [MECH, CHEM]),
  loc('loc-mee-condenser', 's-mee', 'Condenser & cooling tower', MECH, ['mee'], [OPS, ELEC]),
  loc('loc-mee-mcc', 's-mee', 'MCC room', ELEC, ['electrical'], [OPS]),
];

const contacts = (siteId: string, code: string, base: number) => [
  { id: `ec-${code}-team`, siteId, team: 'Emergency team', mobile: `+91 98200 ${base + 11}`, extension: '100' },
  { id: `ec-${code}-fire`, siteId, team: 'Fire & rescue', mobile: `+91 98200 ${base + 22}`, extension: '101' },
  { id: `ec-${code}-medical`, siteId, team: 'First aid / ambulance', mobile: `+91 98200 ${base + 33}`, extension: '102' },
  { id: `ec-${code}-safety`, siteId, team: 'Safety In-charge', mobile: `+91 98200 ${base + 44}`, extension: '103' },
];

export const siteEmergencyContactsSeed = [
  ...contacts('s-etp', 'etp', 41000),
  ...contacts('s-ro', 'ro', 42000),
  ...contacts('s-mee', 'mee', 43000),
];
