import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { Trophy, AlertTriangle, Plus, Trash2, Save } from 'lucide-react';
import {
  WarningReasonConfig, WarningRecord,
  getWarningReasons, saveWarningReasons, getWarningRecords, recordWarning, deleteWarning,
} from '@/lib/warning-penalty';
import { ClubStanding, ClubPointsConfig, computeClubStandings, getClubPointsConfig, saveClubPointsConfig } from '@/lib/club-points';

/**
 * CLUB POINTS + WARNING PENALTY — /club-points
 *
 * One page covering:
 *   1. Live club/team standings (win points − penalty points).
 *   2. Admin: configure points-per-win, and warning reasons + their point value.
 *   3. Record a warning against a player/team/club (Main Referee/Admin action).
 *
 * Entirely additive — does not touch match-engine.ts, gamjeom scoring, or
 * any existing V35/V38 judging behavior. Medal points are read from the
 * persisted tournament-placement ledger, including completed round-robin
 * leagues. Unknown historical club data is intentionally never guessed.
 */
export default function ClubPointsPage() {
  const { lang } = useI18n();
  const isAr = lang === 'ar';

  const [standings, setStandings] = useState<ClubStanding[]>([]);
  const [reasons, setReasons] = useState<WarningReasonConfig[]>([]);
  const [records, setRecords] = useState<WarningRecord[]>([]);
  const [config, setConfig] = useState<ClubPointsConfig>({ pointsPerWin: 3, pointsPerGold: 10, pointsPerSilver: 6, pointsPerBronze: 3 });
  const [configSaved, setConfigSaved] = useState(false);

  const [newReasonLabel, setNewReasonLabel] = useState('');
  const [newReasonLabelAr, setNewReasonLabelAr] = useState('');
  const [newReasonPoints, setNewReasonPoints] = useState(1);

  const [warnClub, setWarnClub] = useState('');
  const [warnReasonId, setWarnReasonId] = useState('');

  const refresh = useCallback(() => {
    setStandings(computeClubStandings());
    setReasons(getWarningReasons());
    setRecords(getWarningRecords());
    setConfig(getClubPointsConfig());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (reasons.length && !warnReasonId) setWarnReasonId(reasons[0].id); }, [reasons, warnReasonId]);

  const handleSaveConfig = () => {
    saveClubPointsConfig(config);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 1500);
    refresh();
  };

  const handleAddReason = () => {
    if (!newReasonLabel.trim()) return;
    const next = [...reasons, {
      id: crypto.randomUUID(),
      label: newReasonLabel.trim(),
      labelAr: newReasonLabelAr.trim() || newReasonLabel.trim(),
      penaltyPoints: newReasonPoints,
    }];
    saveWarningReasons(next);
    setNewReasonLabel(''); setNewReasonLabelAr(''); setNewReasonPoints(1);
    refresh();
  };

  const handleUpdateReasonPoints = (id: string, points: number) => {
    const next = reasons.map((r) => (r.id === id ? { ...r, penaltyPoints: points } : r));
    saveWarningReasons(next);
    refresh();
  };

  const handleDeleteReason = (id: string) => {
    saveWarningReasons(reasons.filter((r) => r.id !== id));
    refresh();
  };

  const handleRecordWarning = () => {
    const reason = reasons.find((r) => r.id === warnReasonId);
    if (!reason || !warnClub.trim()) return;
    recordWarning({
      reasonId: reason.id,
      reasonLabel: isAr ? reason.labelAr : reason.label,
      penaltyPoints: reason.penaltyPoints,
      club: warnClub.trim(),
    });
    setWarnClub('');
    refresh();
  };

  const handleDeleteWarning = (id: string) => {
    deleteWarning(id);
    refresh();
  };

  return (
    <div className="min-h-screen gradient-dark">
      
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="flex items-center gap-2">
          <Trophy className="text-[hsl(var(--gold))]" size={26} />
          <h1 className="title-power text-2xl">{isAr ? 'نقاط الأندية والإنذارات' : 'Club Points & Warning Penalty'}</h1>
        </div>

        {/* ---- Live standings ---- */}
        <section className="panel p-4 md:p-6">
          <h2 className="font-display font-black text-lg mb-4 text-[hsl(var(--gold))]">
            {isAr ? 'ترتيب الأندية الحالي' : 'Current Club Standings'}
          </h2>
          {standings.length === 0 ? (
            <p className="text-[hsl(var(--muted-foreground))] text-sm">
              {isAr ? 'لا توجد بيانات بعد — ستظهر النتائج بعد أول مباراة منتهية.' : 'No data yet — standings appear after the first finished match.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[hsl(var(--muted-foreground))] text-xs uppercase border-b border-white/10">
                    <th className="text-start py-2">{isAr ? 'النادي' : 'Club'}</th>
                    <th className="text-center py-2">{isAr ? 'مباريات' : 'Played'}</th>
                    <th className="text-center py-2">{isAr ? 'فوز' : 'Wins'}</th>
                    <th className="text-center py-2">{isAr ? 'نقاط الفوز' : 'Win pts'}</th>
                    <th className="text-center py-2">🥇</th>
                    <th className="text-center py-2">🥈</th>
                    <th className="text-center py-2">🥉</th>
                    <th className="text-center py-2">{isAr ? 'نقاط الميداليات' : 'Medal pts'}</th>
                    <th className="text-center py-2">{isAr ? 'خصومات' : 'Penalty pts'}</th>
                    <th className="text-center py-2 text-[hsl(var(--gold))]">{isAr ? 'المجموع' : 'Total'}</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s) => (
                    <tr key={s.club} className="border-b border-white/5">
                      <td className="py-2 font-bold">{s.club}</td>
                      <td className="py-2 text-center">{s.matchesPlayed}</td>
                      <td className="py-2 text-center">{s.wins}</td>
                      <td className="py-2 text-center text-green-400">+{s.winPoints}</td>
                      <td className="py-2 text-center">{s.gold}</td>
                      <td className="py-2 text-center">{s.silver}</td>
                      <td className="py-2 text-center">{s.bronze}</td>
                      <td className="py-2 text-center text-green-400">+{s.medalPoints}</td>
                      <td className="py-2 text-center text-red-400">{s.penaltyPoints > 0 ? `-${s.penaltyPoints}` : 0}</td>
                      <td className="py-2 text-center font-black text-[hsl(var(--gold))]">{s.totalPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ---- Points config ---- */}
        <section className="panel p-4 md:p-6">
          <h2 className="font-display font-black text-lg mb-4 text-[hsl(var(--gold))]">
            {isAr ? 'إعداد النقاط' : 'Points Configuration'}
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-[hsl(var(--muted-foreground))]">{isAr ? 'نقاط لكل فوز' : 'Points per win'}</label>
              <input
                type="number" min={0}
                value={config.pointsPerWin}
                onChange={(e) => setConfig({ ...config, pointsPerWin: Number(e.target.value) })}
                className="w-20 rounded-lg bg-black/40 border border-white/10 px-2 py-1 text-center"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-[hsl(var(--gold))]">🥇 {isAr ? 'ذهبية' : 'Gold'}</label>
              <input
                type="number" min={0}
                value={config.pointsPerGold}
                onChange={(e) => setConfig({ ...config, pointsPerGold: Number(e.target.value) })}
                className="w-20 rounded-lg bg-black/40 border border-white/10 px-2 py-1 text-center"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-300">🥈 {isAr ? 'فضية' : 'Silver'}</label>
              <input
                type="number" min={0}
                value={config.pointsPerSilver}
                onChange={(e) => setConfig({ ...config, pointsPerSilver: Number(e.target.value) })}
                className="w-20 rounded-lg bg-black/40 border border-white/10 px-2 py-1 text-center"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-amber-600">🥉 {isAr ? 'برونزية' : 'Bronze'}</label>
              <input
                type="number" min={0}
                value={config.pointsPerBronze}
                onChange={(e) => setConfig({ ...config, pointsPerBronze: Number(e.target.value) })}
                className="w-20 rounded-lg bg-black/40 border border-white/10 px-2 py-1 text-center"
              />
            </div>
            <button onClick={handleSaveConfig} className="btn-power px-4 py-2 rounded-lg flex items-center gap-1.5 text-sm">
              <Save size={14} /> {configSaved ? (isAr ? 'تم الحفظ ✓' : 'Saved ✓') : (isAr ? 'حفظ' : 'Save')}
            </button>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
            {isAr
              ? 'نقاط الميداليات تُسجَّل تلقائيًا فور تحديد الفائز في نهائي البطولة (نظام الخروج المغلوب)، ولا تشمل حاليًا نمط الدوري (Round-Robin).'
              : 'Medal points are recorded automatically the moment a bracket-mode tournament final gets a winner. League/round-robin mode is not covered yet.'}
          </p>
        </section>

        {/* ---- Warning reasons config ---- */}
        <section className="panel p-4 md:p-6">
          <h2 className="font-display font-black text-lg mb-4 text-[hsl(var(--gold))]">
            {isAr ? 'أسباب الإنذار وقيمة الخصم' : 'Warning Reasons & Penalty Values'}
          </h2>
          <div className="space-y-2 mb-4">
            {reasons.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2">
                <span className="flex-1 font-semibold text-sm">{isAr ? r.labelAr : r.label}</span>
                <input
                  type="number" min={0}
                  value={r.penaltyPoints}
                  onChange={(e) => handleUpdateReasonPoints(r.id, Number(e.target.value))}
                  className="w-16 rounded bg-black/40 border border-white/10 px-2 py-1 text-center text-sm"
                />
                <button onClick={() => handleDeleteReason(r.id)} className="text-red-400 hover:text-red-300 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
            <input placeholder={isAr ? 'سبب جديد (EN)' : 'New reason (EN)'} value={newReasonLabel}
              onChange={(e) => setNewReasonLabel(e.target.value)}
              className="flex-1 min-w-[140px] rounded-lg bg-black/40 border border-white/10 px-2 py-1.5 text-sm" />
            <input placeholder={isAr ? 'بالعربية (اختياري)' : 'Arabic (optional)'} value={newReasonLabelAr}
              onChange={(e) => setNewReasonLabelAr(e.target.value)}
              className="flex-1 min-w-[140px] rounded-lg bg-black/40 border border-white/10 px-2 py-1.5 text-sm" />
            <input type="number" min={0} value={newReasonPoints}
              onChange={(e) => setNewReasonPoints(Number(e.target.value))}
              className="w-20 rounded-lg bg-black/40 border border-white/10 px-2 py-1.5 text-center text-sm" />
            <button onClick={handleAddReason} className="btn-power px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm">
              <Plus size={14} /> {isAr ? 'إضافة' : 'Add'}
            </button>
          </div>
        </section>

        {/* ---- Record a warning ---- */}
        <section className="panel p-4 md:p-6">
          <h2 className="font-display font-black text-lg mb-4 flex items-center gap-2 text-[hsl(var(--gold))]">
            <AlertTriangle size={18} /> {isAr ? 'تسجيل إنذار' : 'Record a Warning'}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input placeholder={isAr ? 'اسم النادي / الفريق' : 'Club / team name'} value={warnClub}
              onChange={(e) => setWarnClub(e.target.value)}
              className="flex-1 min-w-[160px] rounded-lg bg-black/40 border border-white/10 px-2 py-1.5 text-sm" />
            <select value={warnReasonId} onChange={(e) => setWarnReasonId(e.target.value)}
              className="rounded-lg bg-black/40 border border-white/10 px-2 py-1.5 text-sm">
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>{isAr ? r.labelAr : r.label} (-{r.penaltyPoints})</option>
              ))}
            </select>
            <button onClick={handleRecordWarning} disabled={!warnClub.trim()}
              className="btn-power px-4 py-1.5 rounded-lg text-sm disabled:opacity-40">
              {isAr ? 'تسجيل' : 'Record'}
            </button>
          </div>

          {records.length > 0 && (
            <div className="max-h-64 overflow-y-auto space-y-1">
              {records.map((w) => (
                <div key={w.id} className="flex items-center gap-2 text-xs bg-black/20 rounded px-2 py-1.5">
                  <span className="opacity-50">{new Date(w.ts).toLocaleString(isAr ? 'ar' : 'en')}</span>
                  <span className="font-bold flex-1">{w.club || w.teamName || w.playerName}</span>
                  <span className="text-red-400">{w.reasonLabel} (-{w.penaltyPoints})</span>
                  <button onClick={() => handleDeleteWarning(w.id)} className="text-red-400/60 hover:text-red-400">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
