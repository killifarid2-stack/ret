// Predefined TKD data for dropdowns

export const TKD_COUNTRIES = [
  'KOR', 'IRN', 'CHN', 'TUR', 'ESP', 'GBR', 'FRA', 'GER', 'ITA', 'USA',
  'MEX', 'BRA', 'ARG', 'COL', 'RUS', 'UKR', 'UZB', 'KAZ', 'THA', 'VNM',
  'TPE', 'JPN', 'AUS', 'CAN', 'EGY', 'MAR', 'TUN', 'ALG', 'SEN', 'CIV',
  'NGR', 'RSA', 'JOR', 'SAU', 'UAE', 'QAT', 'KUW', 'BRN', 'IND', 'PAK',
  'AFG', 'PHL', 'INA', 'MAS', 'SGP', 'NZL', 'CRO', 'SRB', 'BIH', 'MNE',
  'SLO', 'AUT', 'SUI', 'BEL', 'NED', 'SWE', 'NOR', 'DEN', 'FIN', 'POL',
  'CZE', 'SVK', 'HUN', 'ROU', 'BUL', 'GRE', 'POR', 'IRL', 'DOM', 'CUB',
  'VEN', 'PER', 'CHI', 'ECU', 'PAN', 'CRC', 'GUA', 'HON', 'PUR', 'HAI',
  'GEO', 'ARM', 'AZE', 'MGL', 'PRK', 'LAO', 'MYA', 'KHM', 'LBN', 'SYR',
  'IRQ', 'YEM', 'OMA', 'LBY', 'SDN', 'ETH', 'KEN', 'UGA', 'TAN', 'CMR',
  'GAB', 'COD', 'MLI', 'BUR', 'NIG', 'GHA', 'TOG', 'BEN', 'RWA',
];

export const AGE_GROUPS = [
  { value: 'kids', label: 'Kids / صغار (6-11)' },
  { value: 'cadet', label: 'Cadet (12-14)' },
  { value: 'junior', label: 'Junior (15-17)' },
  { value: 'senior', label: 'Senior (18+)' },
  { value: 'u21', label: 'U21 (18-21)' },
  { value: 'veteran', label: 'Veteran (30+)' },
];

// Suggests an age group from a free-typed age (in years). This is only ever
// used to *pre-fill* the Age Group dropdown — the referee/organizer can
// still override it manually, since real federations sometimes classify
// borderline ages differently. Never treat this as an authoritative rule.
export function suggestAgeGroup(age: number): string {
  if (!Number.isFinite(age) || age <= 0) return 'senior';
  if (age <= 11) return 'kids';
  if (age <= 14) return 'cadet';
  if (age <= 17) return 'junior';
  if (age <= 20) return 'u21';
  if (age >= 30) return 'veteran';
  return 'senior';
}

// Builds a competition weight-class string (e.g. "-27kg" / "+27kg") from a
// free-typed number and an under/over toggle — used wherever an organizer
// wants to enter a custom weight instead of picking a preset category.
export function formatFreeWeight(sign: '-' | '+', amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(n) || n <= 0) return '';
  // Keep up to 1 decimal place, but drop a trailing ".0"
  const formatted = Number(n.toFixed(1)).toString();
  return `${sign}${formatted}kg`;
}

export const WEIGHT_CATEGORIES = {
  kids_male: [
    '-20kg', '-23kg', '-26kg', '-29kg', '-32kg', '-35kg', '-38kg', '-41kg', '+41kg',
  ],
  kids_female: [
    '-18kg', '-21kg', '-24kg', '-27kg', '-30kg', '-33kg', '-36kg', '-39kg', '+39kg',
  ],
  cadet_male: [
    '-33kg', '-37kg', '-41kg', '-45kg', '-49kg', '-53kg', '-57kg', '-61kg', '-65kg', '+65kg',
  ],
  cadet_female: [
    '-29kg', '-33kg', '-37kg', '-41kg', '-44kg', '-47kg', '-51kg', '-55kg', '-59kg', '+59kg',
  ],
  junior_male: [
    '-45kg', '-48kg', '-51kg', '-55kg', '-59kg', '-63kg', '-68kg', '-73kg', '-78kg', '+78kg',
  ],
  junior_female: [
    '-42kg', '-44kg', '-46kg', '-49kg', '-52kg', '-55kg', '-59kg', '-63kg', '-68kg', '+68kg',
  ],
  senior_male: [
    '-54kg', '-58kg', '-63kg', '-68kg', '-74kg', '-80kg', '-87kg', '+87kg',
  ],
  senior_female: [
    '-46kg', '-49kg', '-53kg', '-57kg', '-62kg', '-67kg', '-73kg', '+73kg',
  ],
  u21_male: [
    '-54kg', '-58kg', '-63kg', '-68kg', '-74kg', '-80kg', '-87kg', '+87kg',
  ],
  u21_female: [
    '-46kg', '-49kg', '-53kg', '-57kg', '-62kg', '-67kg', '-73kg', '+73kg',
  ],
  veteran_male: [
    '-58kg', '-68kg', '-80kg', '+80kg',
  ],
  veteran_female: [
    '-49kg', '-57kg', '-67kg', '+67kg',
  ],
};

export const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export const COMPETITION_MODES = [
  { value: 'knockout', label: 'Knockout Tournament' },
  { value: 'friendly', label: 'Friendly Match' },
  { value: 'league', label: 'League / Round Robin' },
  { value: 'par_equipe', label: 'Par Équipe (Team)' },
  { value: 'super_fight', label: 'Super Fight / Direct Finals' },
];

export const CLUB_POINTS = {
  gold: 7,
  silver: 5,
  bronze: 3,
};

export function getWeightCategories(ageGroup: string, gender: string): string[] {
  const key = `${ageGroup}_${gender}` as keyof typeof WEIGHT_CATEGORIES;
  return WEIGHT_CATEGORIES[key] || WEIGHT_CATEGORIES.senior_male;
}
