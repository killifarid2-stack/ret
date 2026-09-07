export interface MatCategoryKey {
  tournamentId: string;
  tournamentName: string;
  ageGroup?: string;
  gender?: string;
  weightCategory?: string;
}

export interface MatCategoryPlanEntry extends MatCategoryKey {
  key: string;
}

const KEY = 'wab-tkd-mat-category-plan-v1';

export function makeMatCategoryKey(input: Pick<MatCategoryKey, 'tournamentId' | 'ageGroup' | 'gender' | 'weightCategory'>): string {
  return [input.tournamentId, input.ageGroup || '', input.gender || '', input.weightCategory || '']
    .map(v => String(v).trim().toLowerCase())
    .join('|');
}

function read(): Record<string, MatCategoryPlanEntry[]> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

function write(value: Record<string, MatCategoryPlanEntry[]>) {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* best effort */ }
}

export function getMatCategoryPlan(mat: number): MatCategoryPlanEntry[] {
  return read()[String(mat)] || [];
}

export function setMatCategoryPlan(mat: number, entries: MatCategoryKey[]): void {
  const all = read();
  const unique = new Map<string, MatCategoryPlanEntry>();
  for (const entry of entries) {
    const key = makeMatCategoryKey(entry);
    unique.set(key, { ...entry, key });
  }
  if (unique.size) all[String(mat)] = Array.from(unique.values());
  else delete all[String(mat)];
  write(all);
}

export function toggleMatCategoryPlanEntry(mat: number, entry: MatCategoryKey): MatCategoryPlanEntry[] {
  const current = getMatCategoryPlan(mat);
  const key = makeMatCategoryKey(entry);
  const next = current.some(x => x.key === key) ? current.filter(x => x.key !== key) : [...current, { ...entry, key }];
  setMatCategoryPlan(mat, next);
  return next;
}

/** Empty plan means the mat accepts all categories. */
export function matAcceptsCategory(mat: number, category: MatCategoryKey): boolean {
  const plan = getMatCategoryPlan(mat);
  if (!plan.length) return true;
  const key = makeMatCategoryKey(category);
  return plan.some(x => x.key === key);
}
