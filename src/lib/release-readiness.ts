import { QA_SUITES, QATestStatus, summarize } from './qa-center';

export interface ReadinessCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface ReadinessReport {
  generatedAt: string;
  checks: ReadinessCheck[];
  qa: ReturnType<typeof summarize>;
  ready: boolean;
}

function hasStorage() {
  try { const k = '__wab_probe__'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch { return false; }
}

export function runLocalReadiness(results: Record<string, QATestStatus>): ReadinessReport {
  const checks: ReadinessCheck[] = [
    { id: 'storage', label: 'Local storage', ok: hasStorage(), detail: hasStorage() ? 'Available for safe snapshots and operator state.' : 'Unavailable; recovery cannot be trusted.' },
    { id: 'secure-random', label: 'Secure ID source', ok: !!globalThis.crypto?.randomUUID, detail: globalThis.crypto?.randomUUID ? 'crypto.randomUUID available.' : 'Fallback IDs will be used.' },
    { id: 'qa-critical', label: 'Critical QA suites', ok: QA_SUITES.filter(s => s.severity === 'CRITICAL').every(s => results[s.id] === 'PASS'), detail: 'All critical scenarios must pass.' },
    { id: 'qa-all', label: 'All QA suites', ok: QA_SUITES.every(s => results[s.id] === 'PASS'), detail: 'Every tracked scenario must pass before release.' },
    { id: 'no-fail', label: 'No recorded failures', ok: Object.values(results).every(v => v !== 'FAIL'), detail: 'Recorded failures block release until resolved.' },
  ];
  const qa = summarize(results);
  return { generatedAt: new Date().toISOString(), checks, qa, ready: checks.every(c => c.ok) };
}

export function buildReleaseChecklist(): string[] {
  return [
    'Run QA matrix on every active mat PC.',
    'Confirm one control lease per live match.',
    'Confirm Public Display is output-only.',
    'Confirm final snapshots exist before archive.',
    'Export tournament package after finalization.',
    'Archive only after Supervisor/Admin approval.',
  ];
}
