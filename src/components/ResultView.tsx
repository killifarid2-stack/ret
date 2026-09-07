import React, { useEffect, useState } from 'react';
import { X, Search as SearchIcon, RefreshCw, Trash2, Printer, ClipboardList, Lock, Unlock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getCountryFlag } from '@/lib/flags';
import { loadMatchesLocal } from '@/lib/match-local';
import { isMatchLocked, unlockMatch, lockMatch, logMatchDeleted } from '@/lib/match-lock';

interface MatchRow {
  id: string;
  competition_name: string;
  match_number: number;
  mat_number: number | null;
  weight_category: string | null;
  gender: string | null;
  age_group: string | null;
  match_stage: string | null;
  chung_name: string | null;
  hong_name: string | null;
  chung_nationality: string | null;
  hong_nationality: string | null;
  chung_score: number | null;
  hong_score: number | null;
  chung_gamjeom: number | null;
  hong_gamjeom: number | null;
  chung_head_points: number | null;
  chung_trunk_points: number | null;
  hong_head_points: number | null;
  hong_trunk_points: number | null;
  winner: string | null;
  win_method: string | null;
  finished_at: string | null;
  competition_mode?: string | null;
  team_names?: { chung: string; hong: string } | null;
  // Par Équipe: full roster snapshot saved at match end — lets a finished
  // team match be reviewed later with every player's name, not just the
  // team's own name.
  team_roster?: { chung: { name: string; nationality: string; playerNumber?: number; seedNumber?: number }[]; hong: { name: string; nationality: string; playerNumber?: number; seedNumber?: number }[] } | null;
  mvp_reveal?: { best?: { side:'chung'|'hong'; name:string; photo?:string; nationality?:string; playerNumber?:number; seedNumber?:number; club?:string; points:number; gamjeom:number }; fairPlay?: { side:'chung'|'hong'; name:string; photo?:string; nationality?:string; playerNumber?:number; seedNumber?:number; club?:string; points:number; gamjeom:number }; ts?:number } | null;
  round_winners?: {
    round: number;
    winner: string;
    method: string;
    chungScore: number;
    hongScore: number;
    tiebreakDetails?: {
      reason: string;
      winningCriterion?: string;
      chungHeadKicks: number;
      hongHeadKicks: number;
      chungTrunkKicks: number;
      hongTrunkKicks: number;
      chungValidHits: number;
      hongValidHits: number;
      chungPenalties: number;
      hongPenalties: number;
    };
  }[] | null;
}

function resultLabel(m: MatchRow): string {
  if (!m.winner) return '—';
  const side = m.winner === 'chung' ? 'C' : 'H';
  return `${side}.WIN((${m.win_method || 'PTF'}) Final Score)`;
}

/** Builds the standalone printable HTML for a single match — opened in a
 * new window/tab so the browser's native print dialog can be used, exactly
 * like the existing bracket/CSV export helpers elsewhere in this app. */
function buildPrintableReport(m: MatchRow, includeAll: boolean): string {
  const dateStr = m.finished_at ? new Date(m.finished_at).toLocaleString() : '';
  const winnerIsChung = m.winner === 'chung';
  const chungTotal = (m.chung_head_points || 0) + (m.chung_trunk_points || 0);
  const hongTotal = (m.hong_head_points || 0) + (m.hong_trunk_points || 0);
  const genderLabel = m.gender === 'male' ? 'Male' : m.gender === 'female' ? 'Female' : '';

  const breakdownRows = includeAll ? `
    <tr><td class="num blue">${m.chung_head_points || 0}</td><td class="label">Point of Head</td><td class="num red">${m.hong_head_points || 0}</td></tr>
    <tr><td class="num blue">${m.chung_trunk_points || 0}</td><td class="label">Point of Trunk</td><td class="num red">${m.hong_trunk_points || 0}</td></tr>
    <tr><td class="num blue">${chungTotal}</td><td class="label">Point</td><td class="num red">${hongTotal}</td></tr>
    <tr><td class="num blue">${m.chung_gamjeom || 0}</td><td class="label">Gam-Jeom</td><td class="num red">${m.hong_gamjeom || 0}</td></tr>
  ` : `
    <tr><td class="num blue">${m.chung_score || 0}</td><td class="label">Point</td><td class="num red">${m.hong_score || 0}</td></tr>
    <tr><td class="num blue">${m.chung_gamjeom || 0}</td><td class="label">Gam-Jeom</td><td class="num red">${m.hong_gamjeom || 0}</td></tr>
  `;

  return `<html><head><title>Match Result — #${m.match_number}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#111;padding:24px;max-width:640px;margin:0 auto}
    h1{font-size:20px;margin:0 0 4px}
    .sub{color:#333;font-size:15px;margin:0 0 14px}
    .meta{font-size:12px;color:#555;margin-bottom:12px}
    .banner{border:1px solid #999;border-radius:6px;padding:10px 14px;font-weight:bold;text-align:center;font-size:15px;margin-bottom:18px}
    .names{display:flex;align-items:center;justify-content:center;gap:18px;margin-bottom:18px}
    .side{text-align:center;min-width:140px}
    .side .nm{font-weight:bold;font-size:14px}
    .side .ct{font-size:11px;color:#666}
    .score{font-size:28px;font-weight:900;color:#fff;padding:6px 22px;border-radius:6px;display:inline-block;margin:6px 0}
    .blue-bg{background:#2563eb}.red-bg{background:#dc2626}
    .vs{color:#888;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-bottom:14px}
    td{border:1px solid #ccc;padding:8px;text-align:center;font-size:13px}
    .label{color:#7c3aed;font-weight:600}
    .num.blue{color:#2563eb;font-weight:bold;font-size:15px}
    .num.red{color:#dc2626;font-weight:bold;font-size:15px}
    .footer{display:flex;justify-content:space-between;font-size:12px;color:#444;margin-top:10px}
    hr{border:none;border-top:2px solid #ddd;margin:14px 0}
    @media print{ .no-print{display:none} }
  </style></head><body>
    <h1>MATCH RESULT</h1>
    <p class="sub">${m.weight_category || ''}${genderLabel ? ' (' + genderLabel + ')' : ''}</p>
    <div class="meta">Match No.${String(m.match_number).padStart(3, '0')} &nbsp;•&nbsp; ${dateStr}${m.mat_number ? ' &nbsp;•&nbsp; Court ' + m.mat_number : ''}</div>
    <div class="banner">${resultLabel(m)}</div>
    <div class="names">
      <div class="side">
        <div class="nm" style="color:#2563eb">${m.chung_name || 'CHUNG'}</div>
        <div class="score blue-bg">${m.chung_score ?? 0}</div>
        <div class="ct">${m.chung_nationality || ''}</div>
      </div>
      <div class="vs">VS</div>
      <div class="side">
        <div class="nm" style="color:#dc2626">${m.hong_name || 'HONG'}</div>
        <div class="score red-bg">${m.hong_score ?? 0}</div>
        <div class="ct">${m.hong_nationality || ''}</div>
      </div>
    </div>
    <table>${breakdownRows}</table>
    <div class="footer"><span>Head Gear&nbsp;(O)</span><span>e-Socks&nbsp;(O)</span></div>
    <hr/>
    <button class="no-print" onclick="window.print()" style="padding:8px 16px;cursor:pointer">Print</button>
  </body></html>`;
}

interface ResultViewProps {
  competitionName: string;
  onClose: () => void;
  initialMatchNumber?: number;
}

export default function ResultView({ competitionName, onClose, initialMatchNumber }: ResultViewProps) {
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [weightFilter, setWeightFilter] = useState('');
  const [selected, setSelected] = useState<MatchRow | null>(null);
  const [includeAll, setIncludeAll] = useState(true);
  const [lockVersion, setLockVersion] = useState(0); // bumped to force a re-render after lock/unlock (localStorage-backed, not React state)

  const load = async () => {
    setLoading(true);
    // Merge Supabase with the local cache so a finished match still shows
    // up here even if the cloud save failed (unconfigured/offline) — same
    // resilience pattern used by the Tournament Bracket Strip.
    const localRows = (competitionName ? loadMatchesLocal(competitionName) : []).filter(r => r.status === 'finished') as unknown as MatchRow[];
    let cloudRows: MatchRow[] = [];
    try {
      let q = supabase.from('matches').select('*').eq('status', 'finished').order('finished_at', { ascending: false }).limit(200);
      if (competitionName) q = q.eq('competition_name', competitionName);
      const { data } = await q;
      cloudRows = (data as any) || [];
    } catch { /* offline/unconfigured — local cache still works */ }
    const merged = [...cloudRows, ...localRows.filter(l => !cloudRows.some(c => c.match_number === l.match_number))];
    setRows(merged);
    if (initialMatchNumber != null) {
      const match = merged.find(r => r.match_number === initialMatchNumber);
      if (match) setSelected(match);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [competitionName]);

  const weightOptions = Array.from(new Set(rows.map(r => r.weight_category).filter(Boolean))) as string[];

  const filtered = rows.filter(r => {
    if (weightFilter && r.weight_category !== weightFilter) return false;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      const hay = `${r.chung_name || ''} ${r.hong_name || ''} ${r.match_number}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const handleLatest = () => {
    if (rows.length === 0) return;
    setSelected(rows[0]);
  };

  const handleRemoveAll = async () => {
    // MATCH LOCK: finished matches are locked by default (see match-lock.ts)
    // — bulk delete only ever touches matches an operator has explicitly
    // unlocked. Locked rows are silently skipped, never force-deleted.
    const deletable = filtered.filter(r => !isMatchLocked(r.id));
    const lockedCount = filtered.length - deletable.length;
    if (deletable.length === 0) {
      alert(lockedCount > 0 ? `All ${lockedCount} matches are locked. Unlock a match first (🔓 icon) before deleting it.` : 'Nothing to delete.');
      return;
    }
    const warn = lockedCount > 0 ? `\n(${lockedCount} locked match(es) will be skipped.)` : '';
    if (!confirm(`Delete ${deletable.length} finished match record(s)${competitionName ? ' for "' + competitionName + '"' : ''}? This cannot be undone.${warn}`)) return;
    const ids = deletable.map(r => r.id);
    await supabase.from('matches').delete().in('id', ids);
    logMatchDeleted(`bulk delete${competitionName ? ' — ' + competitionName : ''}`, ids.length);
    load();
  };

  const handleDeleteOne = async (m: MatchRow) => {
    if (isMatchLocked(m.id)) { alert('This match is locked. Unlock it first (🔓 icon) before deleting.'); return; }
    if (!confirm(`Delete match #${String(m.match_number).padStart(3, '0')} (${m.chung_name || '—'} vs ${m.hong_name || '—'})? This cannot be undone.`)) return;
    await supabase.from('matches').delete().eq('id', m.id);
    logMatchDeleted(`#${String(m.match_number).padStart(3, '0')} — ${m.chung_name || '—'} vs ${m.hong_name || '—'}`);
    setSelected(null);
    load();
  };

  const handleToggleLock = (m: MatchRow) => {
    const label = `#${String(m.match_number).padStart(3, '0')} — ${m.chung_name || '—'} vs ${m.hong_name || '—'}`;
    if (isMatchLocked(m.id)) {
      const reason = prompt('Reason for unlocking this finished match? (optional, recorded in the audit log)') || undefined;
      unlockMatch(m.id, label, reason);
    } else {
      lockMatch(m.id, label);
    }
    setLockVersion(v => v + 1);
  };

  const handlePrint = (m: MatchRow) => {
    const html = buildPrintableReport(m, includeAll);
    const w = window.open('', '_blank', 'width=680,height=800');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[90vh] bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[hsl(var(--secondary))] border-b border-[hsl(var(--border))]">
          <h2 className="font-display text-sm font-bold text-[hsl(var(--foreground))] flex items-center gap-2">
            <ClipboardList size={16} className="text-[hsl(var(--primary))]" /> Result View
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[hsl(var(--destructive))]/20 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]">
            <X size={16} />
          </button>
        </div>

        {/* Filters */}
        <div className="p-3 border-b border-[hsl(var(--border))] flex flex-wrap items-center gap-2">
          <select value={weightFilter} onChange={e => setWeightFilter(e.target.value)}
            className="px-2 py-1.5 rounded bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-xs">
            <option value="">All weights</option>
            {weightOptions.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search player or match #"
            className="flex-1 min-w-[160px] px-2 py-1.5 rounded bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-xs" />
          <button onClick={handleLatest} className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-semibold">
            A Latest Match
          </button>
          <button onClick={load} className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--info))]/20 text-[hsl(var(--info))] font-semibold flex items-center gap-1">
            <SearchIcon size={12} /> Search
          </button>
          <button onClick={handleRemoveAll} className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))] font-semibold flex items-center gap-1">
            <Trash2 size={12} /> Remove All
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-xs text-[hsl(var(--muted-foreground))] py-8">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-[hsl(var(--muted-foreground))] py-8">No results yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[hsl(var(--secondary))]">
                <tr className="text-[hsl(var(--muted-foreground))] text-left">
                  <th className="px-3 py-2 font-semibold">Court</th>
                  <th className="px-3 py-2 font-semibold">Match</th>
                  <th className="px-3 py-2 font-semibold">Chung Name</th>
                  <th className="px-3 py-2 font-semibold">Hong Name</th>
                  <th className="px-3 py-2 font-semibold">C.Point</th>
                  <th className="px-3 py-2 font-semibold">H.Point</th>
                  <th className="px-3 py-2 font-semibold">Result</th>
                  <th className="px-3 py-2 font-semibold text-center" title="Locked matches can't be edited/deleted until explicitly unlocked">🔒</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const locked = isMatchLocked(m.id);
                  return (
                  <tr key={`${m.id}-${lockVersion}`} onClick={() => setSelected(m)}
                    className="border-t border-[hsl(var(--border))]/50 hover:bg-[hsl(var(--primary))]/10 cursor-pointer transition-colors">
                    <td className="px-3 py-2">{m.mat_number ?? '—'}</td>
                    <td className="px-3 py-2 font-semibold">{String(m.match_number).padStart(3, '0')}</td>
                    <td className="px-3 py-2 text-[hsl(var(--chung))] font-semibold">{getCountryFlag(m.chung_nationality || '')} {m.chung_name || '—'}</td>
                    <td className="px-3 py-2 text-[hsl(var(--hong))] font-semibold">{getCountryFlag(m.hong_nationality || '')} {m.hong_name || '—'}</td>
                    <td className="px-3 py-2 text-[hsl(var(--chung))] font-bold">{m.chung_score ?? 0}</td>
                    <td className="px-3 py-2 text-[hsl(var(--hong))] font-bold">{m.hong_score ?? 0}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{resultLabel(m)}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={e => { e.stopPropagation(); handleToggleLock(m); }}
                        title={locked ? 'Locked — click to unlock' : 'Unlocked — click to re-lock'}
                        className={`p-1 rounded ${locked ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--destructive))]'} hover:bg-[hsl(var(--secondary))]`}
                      >
                        {locked ? <Lock size={13} /> : <Unlock size={13} />}
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Single match detail — printable report */}
      {selected && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md bg-white text-black rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 bg-[#111] text-white">
              <span className="text-sm font-bold">MATCH RESULT</span>
              <button onClick={() => setSelected(null)} className="text-white/70 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-4">
              <p className="text-sm font-semibold">
                {selected.weight_category} {selected.gender ? `(${selected.gender === 'male' ? 'Male' : 'Female'})` : ''}
              </p>
              <p className="text-xs text-gray-500 mb-3">
                Match No.{String(selected.match_number).padStart(3, '0')} — {selected.finished_at ? new Date(selected.finished_at).toLocaleString() : ''}
              </p>
              <div className="border border-gray-300 rounded-md text-center py-2 font-bold text-sm mb-4">
                {resultLabel(selected)}
              </div>
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="text-center">
                  <div className="font-bold text-blue-600 text-sm">{selected.chung_name || 'CHUNG'}</div>
                  <div className="text-white text-2xl font-black rounded-md px-5 py-1 my-1" style={{background:'#2467d6'}}>{selected.chung_score ?? 0}</div>
                  <div className="text-[10px] text-gray-500">{selected.chung_nationality}</div>
                </div>
                <span className="text-gray-400 text-xs">VS</span>
                <div className="text-center">
                  <div className="font-bold text-red-600 text-sm">{selected.hong_name || 'HONG'}</div>
                  <div className="text-white text-2xl font-black rounded-md px-5 py-1 my-1" style={{background:'#d33a45'}}>{selected.hong_score ?? 0}</div>
                  <div className="text-[10px] text-gray-500">{selected.hong_nationality}</div>
                </div>
              </div>
              {/* Par Équipe: every player who represented each team,
                  restored from the roster snapshot saved at match end. */}
              {selected.mvp_reveal?.best && (
                <div className="mb-4 rounded-xl border-2 border-amber-300/40 bg-amber-50 p-3">
                  <div className="text-[10px] font-black text-amber-700 mb-2">🏆 BEST PLAYER IN THIS MATCH</div>
                  <div className="flex items-center gap-3">
                    {selected.mvp_reveal.best.photo ? <img src={selected.mvp_reveal.best.photo} alt="" className="h-14 w-14 rounded-lg object-cover border border-amber-300"/> : <div className="h-14 w-14 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 font-black">MVP</div>}
                    <div><div className="font-black text-gray-900">{selected.mvp_reveal.best.name}</div><div className="text-[10px] text-gray-600">{selected.mvp_reveal.best.nationality || ''} · #{selected.mvp_reveal.best.playerNumber ?? '—'} · SEED {selected.mvp_reveal.best.seedNumber ?? '—'} · {selected.mvp_reveal.best.club || '—'} · {selected.mvp_reveal.best.points} pts · {selected.mvp_reveal.best.gamjeom} gam-jeom</div></div>
                  </div>
                </div>
              )}

              {selected.competition_mode === 'par_equipe' && selected.team_roster && (
                <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                  {(['chung', 'hong'] as const).map(side => {
                    const roster = selected.team_roster?.[side] || [];
                    if (roster.length === 0) return null;
                    return (
                      <div key={side} className={`rounded-md border p-2 ${side === 'chung' ? 'border-blue-300' : 'border-red-300'}`}>
                        <div className={`font-bold mb-1 ${side === 'chung' ? 'text-blue-600' : 'text-red-600'}`}>
                          {side === 'chung' ? (selected.team_names?.chung || 'CHUNG') : (selected.team_names?.hong || 'HONG')}
                        </div>
                        {[...roster]
                          .sort((a, b) => (a.playerNumber ?? a.seedNumber ?? 0) - (b.playerNumber ?? b.seedNumber ?? 0))
                          .map((p, i) => (
                            <div key={i} className="text-gray-700">{p.name}{p.nationality ? ` (${p.nationality})` : ''}</div>
                          ))}
                      </div>
                    );
                  })}
                </div>
              )}
              <table className="w-full text-xs border-collapse mb-3">
                <tbody>
                  {includeAll ? (
                    <>
                      <tr><td className="border border-gray-300 p-2 text-center text-blue-600 font-bold">{selected.chung_head_points || 0}</td><td className="border border-gray-300 p-2 text-center text-purple-600 font-semibold">Point of Head</td><td className="border border-gray-300 p-2 text-center text-red-600 font-bold">{selected.hong_head_points || 0}</td></tr>
                      <tr><td className="border border-gray-300 p-2 text-center text-blue-600 font-bold">{selected.chung_trunk_points || 0}</td><td className="border border-gray-300 p-2 text-center text-purple-600 font-semibold">Point of Trunk</td><td className="border border-gray-300 p-2 text-center text-red-600 font-bold">{selected.hong_trunk_points || 0}</td></tr>
                      <tr><td className="border border-gray-300 p-2 text-center text-blue-600 font-bold">{(selected.chung_head_points || 0) + (selected.chung_trunk_points || 0)}</td><td className="border border-gray-300 p-2 text-center text-purple-600 font-semibold">Point</td><td className="border border-gray-300 p-2 text-center text-red-600 font-bold">{(selected.hong_head_points || 0) + (selected.hong_trunk_points || 0)}</td></tr>
                    </>
                  ) : null}
                  <tr><td className="border border-gray-300 p-2 text-center text-blue-600 font-bold">{selected.chung_gamjeom || 0}</td><td className="border border-gray-300 p-2 text-center text-purple-600 font-semibold">Gam-Jeom</td><td className="border border-gray-300 p-2 text-center text-red-600 font-bold">{selected.hong_gamjeom || 0}</td></tr>
                </tbody>
              </table>

              {/* Tie-break rounds — any round decided by the AI/referee
                  analysis (points were level) shows the same breakdown that
                  was shown live during the match: strike quality, high-value
                  techniques, and penalties. */}
              {(selected.round_winners || []).some(rw => rw.method === 'ai' && rw.tiebreakDetails) && (
                <div className="mb-3 border border-amber-300 bg-amber-50 rounded-md p-2">
                  <div className="text-[11px] font-bold text-amber-700 mb-1.5">Tie-Break Decisions</div>
                  {(selected.round_winners || []).filter(rw => rw.method === 'ai' && rw.tiebreakDetails).map(rw => (
                    <div key={rw.round} className="text-[10px] text-gray-700 mb-1.5 last:mb-0">
                      <div className="font-semibold">Round {rw.round} — {rw.winner === 'chung' ? (selected.chung_name || 'CHUNG') : (selected.hong_name || 'HONG')} won ({rw.chungScore}-{rw.hongScore} tie)</div>
                      <div className="flex justify-between mt-0.5">
                        <span className="text-blue-600">Head {rw.tiebreakDetails!.chungHeadKicks} · Body {rw.tiebreakDetails!.chungTrunkKicks} · Hits {rw.tiebreakDetails!.chungValidHits} · Pen {rw.tiebreakDetails!.chungPenalties}</span>
                        <span className="text-red-600">Head {rw.tiebreakDetails!.hongHeadKicks} · Body {rw.tiebreakDetails!.hongTrunkKicks} · Hits {rw.tiebreakDetails!.hongValidHits} · Pen {rw.tiebreakDetails!.hongPenalties}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between text-[11px] text-gray-600 mb-3">
                <span>Head Gear&nbsp;(O)</span>
                <span>e-Socks&nbsp;(O)</span>
              </div>
              <div className="flex items-center gap-4 text-xs mb-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={!includeAll} onChange={() => setIncludeAll(false)} /> Summary
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={includeAll} onChange={() => setIncludeAll(true)} /> Include All
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSelected(null)} className="flex-1 py-2 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] text-sm font-semibold">Close</button>
                <button
                  onClick={() => handleDeleteOne(selected)}
                  title={isMatchLocked(selected.id) ? 'Locked — unlock from the list (🔒 icon) before deleting' : 'Delete this match record'}
                  className="py-2 px-3 rounded-lg bg-[hsl(var(--destructive))]/20 text-[hsl(var(--destructive))] text-sm font-semibold flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} />
                </button>
                <button onClick={() => handlePrint(selected)} className="btn-power flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-1.5">
                  <Printer size={14} /> Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
