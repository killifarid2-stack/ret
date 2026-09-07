import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMatch } from '@/context/MatchContext';
import { DEFAULT_CONFIG, DEFAULT_DISPLAY_CONFIG, DisplayConfig, DEFAULT_CALL_DISPLAY_CONFIG, CallDisplayConfig, MatchStage, MATCH_STAGE_LABELS } from '@/types/tkd';
import { Settings, Save, Link as LinkIcon, X, Swords } from 'lucide-react';
import CategoryMatchBrowser from './CategoryMatchBrowser';
import { supabase } from '@/integrations/supabase/client';
import { TKD_COUNTRIES, AGE_GROUPS, GENDERS, COMPETITION_MODES, getWeightCategories } from '@/lib/tkd-data';
import { logAudit } from '@/lib/audit-log';
import { saveTournamentLocal } from '@/lib/tournament-local';
import CountryPicker from './CountryPicker';
import PlayerPicker from './PlayerPicker';
import TournamentPicker from './TournamentPicker';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { getRotationEntryForRound } from '@/lib/match-engine';
import { getWinnerAnimationSettings, setWinnerAnimationSettings } from '@/lib/winner-animation-settings';
import { MatControlMode, getMatControlMode, setMatControlMode, getMatCount, setMatCount, getAssignedMatNumber, setAssignedMatNumber, getMatDeviceName, setMatDeviceName } from '@/lib/mat-status';

const InputField = ({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string | number; onChange: (v: any) => void; type?: string; placeholder?: string;
}) => (
  <div>
    <label className="text-xs text-muted-foreground font-semibold block mb-1">{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
    />
  </div>
);

const PhotoUploadField = ({ id, label, value, onChange, changeLabel = 'Change photo', uploadLabel = 'Upload photo' }: {
  id: string; label: string; value: string; onChange: (v: string) => void; changeLabel?: string; uploadLabel?: string;
}) => {
  const inputId = `photo-upload-${id}`;
  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };
  return (
    <div>
      <label className="text-xs text-muted-foreground font-semibold block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        {value ? (
          <img src={value} alt="" className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-lg border border-dashed border-border shrink-0" />
        )}
        <label htmlFor={inputId}
          className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-xs font-semibold text-center cursor-pointer hover:bg-secondary/70 transition truncate">
          {value ? changeLabel : uploadLabel}
        </label>
        <input id={inputId} type="file" accept="image/*" className="hidden"
          onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
        <button type="button" title="إضافة صورة برابط (URL)"
          onClick={() => {
            const url = window.prompt('رابط الصورة (Photo URL):', /^https?:\/\//i.test(value) ? value : '');
            if (url !== null) onChange(url.trim());
          }}
          className="px-2 py-2 rounded-lg bg-secondary border border-border text-xs text-muted-foreground hover:text-foreground transition shrink-0">
          <LinkIcon size={13} />
        </button>
        {value && (
          <button type="button" onClick={() => onChange('')}
            className="px-2 py-2 rounded-lg bg-secondary border border-border text-xs text-muted-foreground hover:text-foreground transition shrink-0">
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

const SelectField = ({ label, value, onChange, options, selectLabel = 'Select...' }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; selectLabel?: string;
}) => (
  <div>
    <label className="text-xs text-muted-foreground font-semibold block mb-1">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none">
      <option value="">{selectLabel}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

// --- Par Équipe roster editor -----------------------------------------------
interface RosterPlayer { id: string; name: string; nationality: string; photo?: string; playerNumber?: number; seedNumber?: number; rounds?: number }
const toRosterPlayer = (p: { name: string; nationality: string; photo?: string; playerNumber?: number; seedNumber?: number; rounds?: number }): RosterPlayer =>
  ({ id: crypto.randomUUID(), ...p });

/** Add/remove/edit the list of players for one team, right inside Admin.
 *  Mirrors the same roster shape used by Tournament Manager / the
 *  stand-alone Par Équipe setup screen (name, nationality, photo, number)
 *  so a roster entered here plugs into the exact same call-animation /
 *  substitution flow without any conversion.
 *
 *  Player entry is search-first (WAB-TKD spec §36 — "don't create a new
 *  player if one already exists"): typing a name searches the `players`
 *  table (current tournament first, with a one-click option to widen to
 *  every tournament) and picking a result reuses that row's id instead of
 *  minting a new one, so the same competitor never ends up duplicated
 *  under slightly different spellings. Typing a name with no match falls
 *  back to the manual nat/number/photo fields below, same as before. */
const RosterEditor = ({ players, onChange, accentColor, namePlaceholder = 'Player name', natPlaceholder = 'Nat.', tournamentId }: {
  players: RosterPlayer[]; onChange: (p: RosterPlayer[]) => void; accentColor: string; namePlaceholder?: string; natPlaceholder?: string; tournamentId?: string;
}) => {
  const [name, setName] = useState('');
  const [nat, setNat] = useState('');
  const [num, setNum] = useState('');
  const [photo, setPhoto] = useState('');

  const add = () => {
    if (!name.trim()) return;
    onChange([...players, toRosterPlayer({
      name: name.trim(), nationality: nat.trim(),
      playerNumber: num ? parseInt(num) : undefined,
      photo: photo || undefined,
    })]);
    setName(''); setNat(''); setNum(''); setPhoto('');
  };
  const remove = (id: string) => onChange(players.filter(p => p.id !== id));

  return (
    <div className="space-y-2">
      {players.length > 0 && (
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {[...players].sort((a, b) => (a.playerNumber ?? 999) - (b.playerNumber ?? 999)).map(p => (
            <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/60 border border-border text-xs">
              {p.photo ? (
                <img src={p.photo} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" style={{ border: `1.5px solid ${accentColor}` }} />
              ) : (
                <div className="w-7 h-7 rounded-full border border-dashed border-border shrink-0" />
              )}
              <span className="font-bold text-muted-foreground tabular-nums w-5 shrink-0">{p.playerNumber ?? '—'}</span>
              <span className="font-semibold text-foreground flex-1 truncate">{p.name}</span>
              <span className="text-muted-foreground shrink-0">{p.nationality}</span>
              <button type="button" onClick={() => remove(p.id)} className="text-muted-foreground hover:text-foreground shrink-0 px-1">✕</button>
            </div>
          ))}
        </div>
      )}

      <PlayerPicker
        tournamentId={tournamentId}
        excludeIds={players.map(p => p.id)}
        placeholder={namePlaceholder}
        onPick={(picked) => {
          // Reuse the existing players.id — this is what actually prevents
          // the duplicate-competitor problem the spec calls out, since a
          // fresh crypto.randomUUID() here would silently fork the record.
          onChange([...players, {
            id: picked.id, name: picked.name, nationality: picked.nationality,
            photo: picked.photo, playerNumber: picked.playerNumber, seedNumber: picked.seedNumber,
          }]);
        }}
        onManualAdd={(typedName) => setName(typedName)}
      />

      <div className="flex items-center gap-1.5">
        <input value={name} onChange={e => setName(e.target.value)} placeholder={namePlaceholder}
          className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-xs" />
        <CountryPicker value={nat} onChange={setNat} placeholder={natPlaceholder} className="w-20 shrink-0" />
        <input value={num} onChange={e => setNum(e.target.value)} placeholder="#" type="number"
          className="w-12 shrink-0 px-2 py-1.5 rounded-lg bg-secondary border border-border text-foreground text-xs" />
        <PhotoPickerButton value={photo} onChange={setPhoto} />
        <button type="button" onClick={add} className="shrink-0 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold">+</button>
      </div>
    </div>
  );
};

/** Compact single-button photo picker (file or URL) for tight roster rows —
 *  same underlying behavior as PhotoUploadField, just without its label
 *  and preview chrome so it fits in a single input row. */
const PhotoPickerButton = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const id = `roster-photo-${Math.random().toString(36).slice(2)}`;
  return (
    <div className="shrink-0 flex items-center gap-1">
      {value && <img src={value} alt="" className="w-6 h-6 rounded object-cover" />}
      <label htmlFor={id} className="px-2 py-1.5 rounded-lg bg-secondary border border-border text-xs cursor-pointer" title="Photo">📷</label>
      <input id={id} type="file" accept="image/*" className="hidden" onChange={e => {
        const file = e.target.files?.[0]; e.target.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => onChange(reader.result as string);
        reader.readAsDataURL(file);
      }} />
    </div>
  );
};

export default function AdminPanel() {
  const { state, dispatch } = useMatch();
  const { t, lang } = useI18n();

  const [config, setConfig] = useState({ ...state.config });
  // MULTI-MAT (see mat-status.ts + DOCUMENTATION.md §8): per-device setting,
  // not part of MatchState/config — has no bearing on judging/scoring.
  const [matMode, setMatModeState] = useState<MatControlMode>(getMatControlMode());
  const [matCountVal, setMatCountVal] = useState(getMatCount());
  const [assignedMat, setAssignedMat] = useState<number | null>(getAssignedMatNumber());
  const [matDeviceName, setMatDeviceNameState] = useState(getMatDeviceName());
  const [lastPointGap, setLastPointGap] = useState(state.config.pointGap > 0 ? state.config.pointGap : 12);
  const [lastPointCeiling, setLastPointCeiling] = useState(state.config.pointCeiling > 0 ? state.config.pointCeiling : 12);
  const [chungName, setChungName] = useState(state.chung.player.name);
  const [chungNat, setChungNat] = useState(state.chung.player.nationality);
  const [chungClub, setChungClub] = useState(state.chung.player.club || '');
  const [chungSeed, setChungSeed] = useState(state.chung.player.seedNumber?.toString() || '');
  const [chungNum, setChungNum] = useState(state.chung.player.playerNumber?.toString() || '');
  const [chungPhoto, setChungPhoto] = useState(state.chung.player.photoUrl || '');
  const [hongName, setHongName] = useState(state.hong.player.name);
  const [hongNat, setHongNat] = useState(state.hong.player.nationality);
  const [hongClub, setHongClub] = useState(state.hong.player.club || '');
  const [hongSeed, setHongSeed] = useState(state.hong.player.seedNumber?.toString() || '');
  const [hongNum, setHongNum] = useState(state.hong.player.playerNumber?.toString() || '');
  const [hongPhoto, setHongPhoto] = useState(state.hong.player.photoUrl || '');
  const [compName, setCompName] = useState(state.competitionName || '');
  const [matchNum, setMatchNum] = useState(state.matchNumber?.toString() || '');
  const [ageGroup, setAgeGroup] = useState('senior');
  const [gender, setGender] = useState('male');
  const [weightCat, setWeightCat] = useState(state.weightCategory || '');
  const [matchStage, setMatchStage] = useState<MatchStage | ''>(state.matchStage || '');

  // --- Par Équipe (Team Mode) settings — shown inline below as soon as
  // Competition Type is set to "par_equipe", per request: all team-related
  // settings available directly in Admin, not only in the separate
  // Tournament Manager / stand-alone Team setup screens.
  const [teamNameChung, setTeamNameChung] = useState(state.teamNames?.chung || '');
  const [teamNameHong, setTeamNameHong] = useState(state.teamNames?.hong || '');
  const [teamLogoChung, setTeamLogoChung] = useState(state.teamLogos?.chung || '');
  const [teamLogoHong, setTeamLogoHong] = useState(state.teamLogos?.hong || '');
  const [clubLogoChung, setClubLogoChung] = useState(state.clubLogos?.chung || '');
  const [clubLogoHong, setClubLogoHong] = useState(state.clubLogos?.hong || '');
  const [teamCountryChung, setTeamCountryChung] = useState(state.teamCountry?.chung || '');
  const [teamCountryHong, setTeamCountryHong] = useState(state.teamCountry?.hong || '');
  const [teamRosterChung, setTeamRosterChung] = useState<RosterPlayer[]>(state.teamRoster?.chung?.map(toRosterPlayer) || []);
  const [teamRosterHong, setTeamRosterHong] = useState<RosterPlayer[]>(state.teamRoster?.hong?.map(toRosterPlayer) || []);
  const [teamMode, setTeamMode] = useState<'rotation' | 'substitution'>(state.teamMode || 'rotation');
  const [divisionVal, setDivisionVal] = useState(state.division || '');
  const [coachChung, setCoachChung] = useState(state.coachNames?.chung || '');

  // --- "Open in Admin" from Par Équipe archive's "continue remaining
  // matches" list: pre-fill Competition Type + gender/age/weight/match
  // number + both team names straight from the router state that
  // ParEquipeTournamentArchive.tsx passed, instead of leaving the operator
  // to retype everything. Runs once on mount; clears the state afterward
  // (same pattern as Index.tsx's scrollTo) so re-navigating here later
  // doesn't reapply stale values.
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const st = location.state as any;
    const cont = st?.parEquipeContinue || st?.categoryContinue;
    if (!cont) return;
    setConfig(c => ({ ...c, competitionMode: cont.classification === 'team' ? 'par_equipe' : c.competitionMode }));
    if (cont.gender) setGender(cont.gender);
    if (cont.ageGroup) setAgeGroup(cont.ageGroup);
    if (cont.weightCategory) setWeightCat(cont.weightCategory);
    if (cont.matchNumber != null) setMatchNum(String(cont.matchNumber));
    if (cont.classification === 'team') {
      if (cont.chungName || cont.team1) setTeamNameChung(cont.chungName || cont.team1);
      if (cont.hongName || cont.team2) setTeamNameHong(cont.hongName || cont.team2);
    } else {
      if (cont.chungName) setChungName(cont.chungName);
      if (cont.hongName) setHongName(cont.hongName);
    }
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [coachHong, setCoachHong] = useState(state.coachNames?.hong || '');
  // WAB-TKD "تسجيل البطولات" fix: an explicitly picked existing tournament
  // (via TournamentPicker) takes priority over both state.tournamentId and
  // the auto-create fallback in handleSave. undefined = nothing picked yet
  // this session, so existing behavior (reuse state.tournamentId if any,
  // else auto-create) is preserved exactly as before.
  const [pickedTournament, setPickedTournament] = useState<{ id: string; name: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Gender→Age→Weight category library (see category-library.ts): browse
  // matches already saved in a category and Generate a new one with just
  // names — gender/age/weight/tournament are filled in automatically here
  // from what the browser just created, same as the Par Équipe continue-flow above.
  const [showCategoryBrowser, setShowCategoryBrowser] = useState(false);
  const [showIvrLog, setShowIvrLog] = useState(false);
  const [ivrLog, setIvrLog] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('tkd-ivr-log') || '[]'); } catch { return []; }
  });
  useEffect(() => {
    const iv = setInterval(() => {
      try { setIvrLog(JSON.parse(localStorage.getItem('tkd-ivr-log') || '[]')); } catch {}
    }, 1500);
    return () => clearInterval(iv);
  }, []);


  const weightCategories = getWeightCategories(ageGroup, gender);
  const countryOptions = TKD_COUNTRIES.map(c => ({ value: c, label: c }));

  const handleSave = async () => {
    // Par Équipe could previously be started with two empty/nameless teams
    // and no players in either roster — the match would go "live" straight
    // into an empty call-animation with nothing to substitute or score
    // against. Block it here with a clear message instead of failing
    // silently later inside the roster/call-animation logic.
    if (config.competitionMode === 'par_equipe') {
      const missing: string[] = [];
      if (!teamNameChung.trim()) missing.push('اسم فريق Chung (الأزرق)');
      if (!teamNameHong.trim()) missing.push('اسم فريق Hong (الأحمر)');
      if (teamRosterChung.length === 0) missing.push('لائحة لاعبي فريق Chung (فارغة)');
      if (teamRosterHong.length === 0) missing.push('لائحة لاعبي فريق Hong (فارغة)');
      if (missing.length > 0) {
        toast.error('ما تقدرش تبدئي مباراة بار إيكيب هكذا', {
          description: `خاصك: ${missing.join(' • ')}`,
        });
        return;
      }
    }

    let assignedNum = parseInt(matchNum) || 0;
    // Auto match number — assign for any mode (incl. friendly) when field is blank.
    if (!assignedNum) {
      try {
        const q = supabase.from('matches').select('match_number');
        const { data } = compName
          ? await q.eq('competition_name', compName).order('match_number', { ascending: false }).limit(1)
          : await q.order('match_number', { ascending: false }).limit(1);
        const maxN = data && data[0] ? Number(data[0].match_number) || 0 : 0;
        assignedNum = maxN + 1;
        setMatchNum(String(assignedNum));
      } catch {
        assignedNum = Math.floor(Date.now() / 1000) % 100000;
        setMatchNum(String(assignedNum));
      }
    }

    // Editing an already-ongoing match (status !== 'waiting', e.g. tweaking
    // the roster/logos mid-fight) must NOT go through INIT_MATCH — that
    // replaces the ENTIRE match state with a brand-new blank one
    // (createInitialMatchState), silently wiping the live score, round,
    // and timer. The Par Équipe roster/logo edits below would still land
    // (they're dispatched after), but the operator would come back to a
    // reset match — which read as "nothing changed" because the edited
    // fields ended up looking identical to what a fresh match already
    // shows. For a genuinely new match (status === 'waiting'), INIT_MATCH
    // is still correct and needed to apply rule changes (rounds, timing).
    const isEditingOngoingMatch = state.status !== 'waiting';
    if (isEditingOngoingMatch) {
      dispatch({ type: 'UPDATE_CONFIG', config });
    } else {
      dispatch({ type: 'INIT_MATCH', config });
    }
    logAudit('config_saved', `Match config updated (rounds: ${config.rounds}, round time: ${config.roundTime}s, point gap: ${config.pointGap ?? 'off'})`);
    // Par Équipe "rotation": round 1's on-the-mat athlete must come from the
    // roster's own round-1 assignment (getRotationEntryForRound(roster, 0)),
    // exactly like round 2+ already gets it from START_NEXT_ROUND. Without
    // this, only the separate top "player name" fields above were ever used
    // to seed state.chung.player / state.hong.player — if the operator
    // filled in the roster (with each athlete's number of rounds) but left
    // those separate name fields blank, expecting the roster to be the
    // single source of truth, round 1 started with an EMPTY player name
    // that matches no roster entry: the round-history/MVP matching in
    // finalizeRoundResult (`entry.name === state[side].player.name`) then
    // never finds that player in the roster, since '' never equals a real
    // name — surfacing as "no player assigned to this round". Only applies
    // when starting a genuinely NEW match (not while editing an ongoing
    // one, where the live on-the-mat player must never be silently
    // replaced) and only overrides when the roster actually has an entry
    // for round 1; otherwise the manually typed fields are kept exactly as
    // before (substitution mode, or rotation mode with an empty roster).
    const isNewTeamMatch = !isEditingOngoingMatch && config.competitionMode === 'par_equipe' && teamMode === 'rotation';
    const chungRound1 = isNewTeamMatch ? getRotationEntryForRound(teamRosterChung, 0) : undefined;
    const hongRound1 = isNewTeamMatch ? getRotationEntryForRound(teamRosterHong, 0) : undefined;
    dispatch({
      type: 'SET_PLAYER', color: 'chung',
      name: chungRound1?.name ?? chungName,
      nationality: chungRound1?.nationality ?? chungNat,
      club: chungClub,
      seedNumber: (chungRound1?.seedNumber ?? (chungSeed ? parseInt(chungSeed) : undefined)),
      playerNumber: (chungRound1?.playerNumber ?? (chungNum ? parseInt(chungNum) : undefined)),
      photoUrl: chungRound1?.photo ?? (chungPhoto || undefined),
    });
    dispatch({
      type: 'SET_PLAYER', color: 'hong',
      name: hongRound1?.name ?? hongName,
      nationality: hongRound1?.nationality ?? hongNat,
      club: hongClub,
      seedNumber: (hongRound1?.seedNumber ?? (hongSeed ? parseInt(hongSeed) : undefined)),
      playerNumber: (hongRound1?.playerNumber ?? (hongNum ? parseInt(hongNum) : undefined)),
      photoUrl: hongRound1?.photo ?? (hongPhoto || undefined),
    });

    // Par Équipe: push all team-identity + roster fields into central
    // match state in one go, exactly like the stand-alone Team setup
    // screen / Tournament Manager do — so a roster entered here plugs
    // straight into the same call-animation / substitution logic.
    const isTeamMode = config.competitionMode === 'par_equipe';
    if (isTeamMode) {
      dispatch({
        type: 'SET_MATCH_INFO',
        teamNames: { chung: teamNameChung, hong: teamNameHong },
        teamLogos: { chung: teamLogoChung || undefined, hong: teamLogoHong || undefined },
        clubLogos: { chung: clubLogoChung || undefined, hong: clubLogoHong || undefined },
        teamCountry: { chung: teamCountryChung || undefined, hong: teamCountryHong || undefined },
        division: divisionVal || undefined,
        coachNames: { chung: coachChung || undefined, hong: coachHong || undefined },
      });
      dispatch({
        type: 'SET_TEAM_ROSTER',
        teamMode,
        roster: {
          chung: teamRosterChung.map(({ id, ...p }) => p),
          hong: teamRosterHong.map(({ id, ...p }) => p),
        },
      });
    }

    // Any match Admin saves must belong to a tournament, even a
    // stand-alone one entered here directly (not built via the bracket
    // manager). If the referee explicitly searched for and picked an
    // existing tournament (TournamentPicker above), attach to that one —
    // never create a duplicate. Otherwise fall back to state.tournamentId
    // if already set, and only auto-create a brand-new single-match
    // tournament wrapper as a last resort (unchanged from before).
    let tournamentId = pickedTournament?.id || state.tournamentId;
    if (!tournamentId) {
      tournamentId = `local-${crypto.randomUUID()}`;
      const tName = compName?.trim() || `${chungName || 'Chung'} vs ${hongName || 'Hong'}`;
      const localRecord = {
        id: tournamentId, name: tName, gender, weight_category: weightCat, age_group: ageGroup, format: 'single-match',
        bracket_data: null, players: [], created_at: new Date().toISOString(),
      };
      saveTournamentLocal(localRecord);
      try {
        const { data, error } = await supabase.from('tournaments').insert({
          name: tName, format: 'single-match', age_group: ageGroup, gender, weight_category: weightCat, status: 'active',
        }).select().single();
        if (!error && data) {
          tournamentId = data.id;
          saveTournamentLocal({ ...localRecord, id: data.id });
        }
      } catch (e) {
        // Kept locally with the "local-" id above — fine offline, and it
        // still links this match consistently even without the cloud.
        console.warn('Auto tournament cloud sync failed (kept locally):', e);
      }
    }

    dispatch({
      type: 'SET_MATCH_INFO',
      competitionName: compName,
      matchNumber: assignedNum,
      weightCategory: weightCat,
      gender: gender as 'male' | 'female',
      ageGroup,
      matchStage: matchStage || undefined,
      tournamentId,
    });

    // Save to database
    try {
      await supabase.from('matches').insert({
        competition_name: compName,
        match_number: assignedNum,
        weight_category: weightCat,
        gender,
        age_group: ageGroup,
        match_stage: matchStage || null,
        chung_name: chungName,
        hong_name: hongName,
        chung_nationality: chungNat,
        hong_nationality: hongNat,
        // Division + coach names have no dedicated columns yet — piggyback
        // them on the existing free-form `config` JSON blob (same pattern
        // already used for the rest of MatchConfig) rather than requiring
        // a schema migration for two optional Par Équipe setup fields.
        config: (isTeamMode ? { ...config, division: divisionVal || undefined, coachNames: { chung: coachChung || undefined, hong: coachHong || undefined } } : config) as any,
        status: 'waiting',
        tournament_id: tournamentId,
        competition_mode: config.competitionMode,
        ...(isTeamMode ? {
          team_names: { chung: teamNameChung, hong: teamNameHong },
          team_logos: { chung: teamLogoChung || null, hong: teamLogoHong || null },
          club_logos: { chung: clubLogoChung || null, hong: clubLogoHong || null },
          team_country: { chung: teamCountryChung || null, hong: teamCountryHong || null },
          team_roster: {
            chung: teamRosterChung.map(({ id, ...p }) => p),
            hong: teamRosterHong.map(({ id, ...p }) => p),
          },
        } : {}),
      } as any);
      setSaved(true);
      setSaveError(null);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      // Previously silent — a failed save (network, RLS, bad connection...)
      // left the operator thinking everything was saved when nothing was,
      // discovered only much later. Now surfaced clearly, and stays
      // visible (no auto-hide) until the next save attempt succeeds.
      console.error('Save error:', e);
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  };


  return (
    <div className="min-h-screen gradient-dark">
      
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="panel p-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="title-power text-xl flex items-center gap-2">
              <Settings size={20} className="text-[hsl(var(--gold))]" /> {t('adminTitle')}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">{t('adminSubtitle')}</p>
          </div>
          <button type="button" onClick={() => setShowCategoryBrowser(true)}
            title="تصفح حسب الجنس ← الفئة العمرية ← الوزن، وتوليد مباريات جديدة بالاسم فقط"
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] font-semibold flex items-center gap-1">
            <Swords size={12} /> مكتبة الفئات
          </button>
        </div>

        {/* Multi-Mat settings — see DOCUMENTATION.md §8 for the full bilingual
            explanation of both modes and why each button exists. */}
        <div className="panel p-4">
          <h2 className="font-display text-sm font-bold text-foreground mb-3">
            البساط المتعدد / Multi-Mat
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">
                وضع هذا الجهاز / This device's mode
              </label>
              <select value={matMode}
                onChange={e => { const m = e.target.value as MatControlMode; setMatModeState(m); setMatControlMode(m); }}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm">
                <option value="single">بساط واحد (افتراضي) / Single mat (default)</option>
                <option value="control_room">غرفة تحكم مركزية / Control Room</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">
                عدد البسطات (لغرفة التحكم) / Mat count (for Control Room)
              </label>
              <input type="number" min={1} max={32} value={matCountVal}
                onChange={e => { const n = parseInt(e.target.value, 10) || 1; setMatCountVal(n); setMatCount(n); }}
                disabled={matMode !== 'control_room'}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm disabled:opacity-40" />
            </div>
          </div>
          <div className="mt-3 p-3 rounded-xl border border-[hsl(var(--gold))]/25 bg-[hsl(var(--gold))]/5">
            <div className="text-xs font-display font-black text-[hsl(var(--gold))] mb-2">تعيين هذا الكمبيوتر / ASSIGN THIS COMPUTER TO A MAT</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground font-semibold block mb-1">رقم البساط / Assigned Mat</label>
                <select value={assignedMat ?? ''} onChange={e => { const n = e.target.value ? Number(e.target.value) : null; setAssignedMat(n); setAssignedMatNumber(n); if (n) dispatch({ type: 'SET_MATCH_INFO', matNumber: n }); }} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm">
                  <option value="">غير مخصص / Not assigned</option>
                  {Array.from({length: matCountVal}, (_, i) => i + 1).map(n => <option key={n} value={n}>MAT {String(n).padStart(2,'0')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-semibold block mb-1">اسم الجهاز / Device Name</label>
                <input value={matDeviceName} onChange={e => { setMatDeviceNameState(e.target.value); setMatDeviceName(e.target.value); }} placeholder="مثال: MAT-02-PC" className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm" />
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground mt-2 leading-relaxed">هذا التعيين محلي لهذا الكمبيوتر فقط. جميع أجهزة البسطات تستخدم نفس Supabase، لذلك كل جهاز يرسل حالته تحت رقم بساطه، وغرفة التحكم المركزية تقرأها كلها في شاشة واحدة.</p>
          </div>

          <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
            <b>بساط واحد:</b> السلوك الافتراضي — هذا الجهاز/النافذة يدير بساطًا واحدًا فقط (كما كان دائمًا). كل بساط فعلي يحتاج جهاز/نافذة Electron خاصة به.
            <br />
            <b>غرفة تحكم مركزية:</b> يضيف رابط "غرفة التحكم" في القائمة العلوية، يعرض حالة كل البسطات حيًّا جنبًا إلى جنب، ويتيح لهذه النافذة التبديل للتحكم بأي بساط عند الحاجة. لا يشغّل هذا الوضع أكثر من مباراة حية واحدة في نفس الوقت من نفس النافذة.
            <br />
            <b>Single mat:</b> default behavior — this window runs exactly one mat, unchanged from before. Every physical mat still needs its own Electron instance.
            <br />
            <b>Control Room:</b> adds a "Control Room" link to the top nav, shows every mat's live status side-by-side, and lets this window switch which mat it's controlling. Does not run more than one live match at a time from this window.
          </p>
        </div>

        {/* Attach to an existing tournament ("تسجيل البطولات" fix) —
            search-first, mirrors PlayerPicker's don't-duplicate pattern.
            No match typed → falls through to the existing auto-create
            behavior in handleSave, unchanged. */}
        <div className="panel p-4">
          <h2 className="font-display text-sm font-bold text-foreground mb-2">
            {lang === 'ar' ? 'ربط بالبطولة' : 'Attach to Tournament'}
          </h2>
          <TournamentPicker
            onPick={(tr) => {
              setPickedTournament({ id: tr.id, name: tr.name });
              setCompName(tr.name);
              if (tr.gender) setGender(tr.gender);
              if (tr.weightCategory) setWeightCat(tr.weightCategory);
              if (tr.ageGroup) setAgeGroup(tr.ageGroup);
            }}
          />
          {pickedTournament && (
            <div className="mt-2 flex items-center justify-between text-[11px] bg-primary/10 text-primary rounded-lg px-3 py-1.5">
              <span>{lang === 'ar' ? 'مرتبط بـ' : 'Linked to'}: <b>{pickedTournament.name}</b></span>
              <button type="button" onClick={() => setPickedTournament(null)} className="text-muted-foreground hover:text-foreground">
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Competition info */}
        <div className="panel p-4">
          <h2 className="font-display text-sm font-bold text-foreground mb-3">{t('competitionInfo')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <InputField label={t('competitionName')} value={compName} onChange={setCompName} placeholder={t('competitionNamePlaceholder')} />
            <InputField label={t('matchNumberLabel')} value={matchNum} onChange={setMatchNum} type="number" placeholder={t('autoPlaceholder')} />

            <SelectField label={t('ageGroupLabel')} value={ageGroup} onChange={v => { setAgeGroup(v); setWeightCat(''); }}
              options={AGE_GROUPS} selectLabel={t('selectPlaceholder')} />
            <SelectField label={t('genderLabel')} value={gender} onChange={v => { setGender(v); setWeightCat(''); }}
              options={GENDERS} selectLabel={t('selectPlaceholder')} />
            <SelectField label={t('weightCategoryLabel')} value={weightCat} onChange={setWeightCat}
              options={weightCategories.map(w => ({ value: w, label: w }))} selectLabel={t('selectPlaceholder')} />
            <SelectField label={t('knockoutStageLabel')} value={matchStage} onChange={v => setMatchStage(v as MatchStage | '')}
              options={(Object.keys(MATCH_STAGE_LABELS) as MatchStage[]).map(s => ({ value: s, label: MATCH_STAGE_LABELS[s].en }))} selectLabel={t('selectPlaceholder')} />
          </div>
        </div>

        {/* Players */}
        <div className="panel p-4">
          <h2 className="font-display text-sm font-bold text-foreground mb-3">{t('playersSection')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 p-3 rounded-lg border border-hong/30 bg-hong/5 order-1">
              <div className="text-xs font-bold text-hong">{t('hong')} (Red)</div>
              <InputField label={t('nameLabel')} value={hongName} onChange={setHongName} />
              <SelectField label={t('nationality')} value={hongNat} onChange={setHongNat} options={countryOptions} selectLabel={t('selectPlaceholder')} />
              <InputField label={t('club')} value={hongClub} onChange={setHongClub} placeholder={t('clubPlaceholder')} />
              <div className="grid grid-cols-2 gap-2">
                <InputField label={t('seedLabel')} value={hongSeed} onChange={setHongSeed} type="number" placeholder={t('optionalPlaceholder')} />
                <InputField label={t('playerNumLabel')} value={hongNum} onChange={setHongNum} type="number" placeholder={t('optionalPlaceholder')} />
              </div>
              <PhotoUploadField id="hong" label={t('playerPhotoLabel')} value={hongPhoto} onChange={setHongPhoto} changeLabel={t('changePhotoLabel')} uploadLabel={t('uploadPhotoLabel')} />
            </div>
            <div className="space-y-2 p-3 rounded-lg border border-chung/30 bg-chung/5 order-2">
              <div className="text-xs font-bold text-chung">{t('chung')} (Blue)</div>
              <InputField label={t('nameLabel')} value={chungName} onChange={setChungName} />
              <SelectField label={t('nationality')} value={chungNat} onChange={setChungNat} options={countryOptions} selectLabel={t('selectPlaceholder')} />
              <InputField label={t('club')} value={chungClub} onChange={setChungClub} placeholder={t('clubPlaceholder')} />
              <div className="grid grid-cols-2 gap-2">
                <InputField label={t('seedLabel')} value={chungSeed} onChange={setChungSeed} type="number" placeholder={t('optionalPlaceholder')} />
                <InputField label={t('playerNumLabel')} value={chungNum} onChange={setChungNum} type="number" placeholder={t('optionalPlaceholder')} />
              </div>
              <PhotoUploadField id="chung" label={t('playerPhotoLabel')} value={chungPhoto} onChange={setChungPhoto} changeLabel={t('changePhotoLabel')} uploadLabel={t('uploadPhotoLabel')} />
            </div>

          </div>
        </div>

        {/* Public Display — show/hide toggles (applies live to the audience screen) */}
        <div className="panel p-4">
          <h2 className="font-display text-sm font-bold text-foreground mb-1">{t('publicDisplayTitle')}</h2>
          <p className="text-[11px] text-muted-foreground mb-3">{t('publicDisplaySubtitle')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {([
              ['showFlag', t('flagToggle')],
              ['showClub', t('clubToggle')],
              ['showPhoto', t('playerPhotoToggle')],
              ['showStage', t('matchStageToggle')],
              ['showWeight', t('weightCategoryToggle')],
            ] as [keyof DisplayConfig, string][]).map(([key, label]) => {
              const dc = { ...DEFAULT_DISPLAY_CONFIG, ...(state.displayConfig || {}) };
              return (
                <label key={key} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-secondary/40 cursor-pointer hover:bg-secondary/70 transition">
                  <input
                    type="checkbox"
                    checked={!!dc[key]}
                    onChange={e => dispatch({ type: 'SET_DISPLAY_CONFIG', displayConfig: { [key]: e.target.checked } })}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-xs font-semibold text-foreground">{label}</span>
                </label>
              );
            })}
          </div>

          {/* Individual 1v1 Winner Result cinematic controls. These settings are
              session-level and are also mirrored to localStorage so a second
              public display opened/reloaded later keeps the same choice. */}
          {(() => {
            const dc = { ...DEFAULT_DISPLAY_CONFIG, ...(state.displayConfig || {}) };
            const saved = getWinnerAnimationSettings();
            const duration = Number(dc.winnerAnimationDurationSeconds ?? saved.durationSeconds ?? 3);
            const setWinner = (patch: Partial<DisplayConfig>) => {
              const nextPatch = patch.winnerAnimationEnabled !== undefined
                ? { ...patch, winnerAnimationEnabled: patch.winnerAnimationEnabled }
                : patch;
              const winnerPatch = {
                enabled: nextPatch.winnerAnimationEnabled ?? dc.winnerAnimationEnabled,
                durationSeconds: nextPatch.winnerAnimationDurationSeconds ?? duration,
              };
              setWinnerAnimationSettings(winnerPatch);
              dispatch({ type: 'SET_DISPLAY_CONFIG', displayConfig: {
                winnerAnimationEnabled: winnerPatch.enabled,
                winnerAnimationDurationSeconds: winnerPatch.durationSeconds,
              }});
            };
            return (
              <div className="mt-4 rounded-xl border border-gold/20 bg-black/20 p-3">
                <div className="mb-1 font-display text-xs font-black uppercase tracking-[.18em] text-gold">{t('winnerAnimationSettingsTitle')}</div>
                <p className="mb-3 text-[10px] text-muted-foreground">{t('winnerAnimationSettingsSubtitle')}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dc.winnerAnimationEnabled !== false}
                      onChange={e => setWinner({ winnerAnimationEnabled: e.target.checked })}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-xs font-semibold text-foreground">{t('winnerAnimationEnabledToggle')}</span>
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-2">
                    <span className="text-xs font-semibold text-foreground">{t('winnerAnimationDurationLabel')}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.5}
                        value={Number.isFinite(duration) ? duration : 3}
                        onChange={e => {
                          const v = Math.min(10, Math.max(0, Number(e.target.value) || 0));
                          setWinner({ winnerAnimationDurationSeconds: v });
                        }}
                        disabled={dc.winnerAnimationEnabled === false}
                        className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                      />
                      <span className="text-[10px] text-muted-foreground">{t('secondsLabel')}</span>
                    </div>
                  </label>
                </div>
                <div className="mt-2 text-[10px] text-white/45">
                  {t('winnerAnimationDirectResultHint')}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Call Screen Display — show/hide toggles for the "استدعاء" cinematic
            (Par Équipe team + player call). Separate from the live scoreboard
            toggles above since the call screen has its own set of elements. */}
        <div className="panel p-4">
          <h2 className="font-display text-sm font-bold text-foreground mb-1">{t('callScreenTitle')}</h2>
          <p className="text-[11px] text-muted-foreground mb-3">{t('callScreenSubtitle')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {([
              ['showTeamLogo', t('teamLogoToggle')],
              ['showClubLogo', t('clubLogoToggle')],
              ['showTeamCountry', t('teamCountryToggle')],
              ['showRosterList', t('rosterListToggle')],
              ['showRosterPhotos', t('rosterPhotosToggle')],
              ['showTournamentName', t('tournamentNameToggle')],
              ['showPlayerPhoto', t('playerPhotoCallToggle')],
              ['showPlayerFlag', t('playerFlagCallToggle')],
              ['showPlayerNumbers', t('playerNumbersToggle')],
              ['showCategory', t('categoryToggle')],
              ['showGender', t('genderToggle')],
            ] as [keyof CallDisplayConfig, string][]).map(([key, label]) => {
              const cc = state.callDisplayConfig || DEFAULT_CALL_DISPLAY_CONFIG;
              return (
                <label key={key} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-secondary/40 cursor-pointer hover:bg-secondary/70 transition">
                  <input
                    type="checkbox"
                    checked={!!cc[key]}
                    onChange={e => dispatch({ type: 'SET_CALL_DISPLAY_CONFIG', callDisplayConfig: { [key]: e.target.checked } })}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-xs font-semibold text-foreground">{label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Call Animation — Look & Feel: lightIntensity and nameFormat both
            already existed on CallDisplayConfig and were fully wired into
            every call cinematic (ExactPlayerCallV515, TeamCallOverlay,
            broadcast-new's TeamPanel, etc.) but had no UI control anywhere —
            an admin could never actually change either one. */}
        <div className="panel p-4">
          <h2 className="font-display text-sm font-bold text-foreground mb-1">{t('animationControlsTitle')}</h2>
          <p className="text-[11px] text-muted-foreground mb-3">{t('animationControlsSubtitle')}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-2">{t('lightIntensityLabel')}</label>
              <div className="space-y-2">
                {([
                  ['broadcast', t('lightIntensityBroadcast')],
                  ['subtle', t('lightIntensitySubtle')],
                ] as [CallDisplayConfig['lightIntensity'], string][]).map(([value, label]) => {
                  const cc = state.callDisplayConfig || DEFAULT_CALL_DISPLAY_CONFIG;
                  return (
                    <label key={value} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-secondary/40 cursor-pointer hover:bg-secondary/70 transition">
                      <input
                        type="radio"
                        name="lightIntensity"
                        checked={cc.lightIntensity === value}
                        onChange={() => dispatch({ type: 'SET_CALL_DISPLAY_CONFIG', callDisplayConfig: { lightIntensity: value } })}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-xs font-semibold text-foreground">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-2">{t('nameFormatLabel')}</label>
              <div className="space-y-2">
                {([
                  ['full', t('nameFormatFull')],
                  ['initial', t('nameFormatInitial')],
                  ['large-initial', t('nameFormatLargeInitial')],
                  ['stacked', t('nameFormatStacked')],
                ] as [CallDisplayConfig['nameFormat'], string][]).map(([value, label]) => {
                  const cc = state.callDisplayConfig || DEFAULT_CALL_DISPLAY_CONFIG;
                  return (
                    <label key={value} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-secondary/40 cursor-pointer hover:bg-secondary/70 transition">
                      <input
                        type="radio"
                        name="nameFormat"
                        checked={cc.nameFormat === value}
                        onChange={() => dispatch({ type: 'SET_CALL_DISPLAY_CONFIG', callDisplayConfig: { nameFormat: value } })}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-xs font-semibold text-foreground">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label className="text-xs font-semibold text-foreground block mb-2">{t('readyHoldLabel')}</label>
            <p className="text-[10px] text-muted-foreground mb-2">{t('readyHoldHint')}</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={(state.callDisplayConfig || DEFAULT_CALL_DISPLAY_CONFIG).readyHoldSeconds ?? 3}
                onChange={e => dispatch({ type: 'SET_CALL_DISPLAY_CONFIG', callDisplayConfig: { readyHoldSeconds: Number(e.target.value) } })}
                className="flex-1 accent-primary"
              />
              <span className="text-sm font-black text-foreground w-12 text-center">{(state.callDisplayConfig || DEFAULT_CALL_DISPLAY_CONFIG).readyHoldSeconds ?? 3}{t('secondsLabel')}</span>
            </div>
          </div>
        </div>

        {/* Rules */}
        <div className="panel p-4">
          <h2 className="font-display text-sm font-bold text-foreground mb-3">{t('competitionRulesTitle')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label={t('competitionTypeLabel')} value={config.competitionMode || 'knockout'}
              onChange={(v: string) => setConfig({ ...config, competitionMode: v as typeof config.competitionMode })}
              options={COMPETITION_MODES} selectLabel={t('selectPlaceholder')} />
            <InputField label={t('roundsLabel')} value={config.rounds} onChange={(v: number) => setConfig({...config, rounds: v})} type="number" />
            <label className="flex items-start gap-2 p-3 rounded-lg border border-border bg-secondary/30 cursor-pointer col-span-2">
              <input type="checkbox" checked={config.allowSoloPlayerMerge !== false}
                onChange={e => setConfig({ ...config, allowSoloPlayerMerge: e.target.checked })}
                className="mt-0.5 w-4 h-4 accent-primary" />
              <span><span className="text-xs font-bold text-foreground block">{t('smartSoloMergeLabel')}</span><span className="text-[10px] text-muted-foreground">{t('smartSoloMergeDesc')}</span></span>
            </label>
            <InputField label={t('roundTimeLabel')} value={config.roundTime} onChange={(v: number) => setConfig({...config, roundTime: v})} type="number" />
            <InputField label={t('restTimeLabel')} value={config.restTime} onChange={(v: number) => setConfig({...config, restTime: v})} type="number" />
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                {t('kyeshiTimeLabel')}
                <span className="flex items-center gap-1.5 font-normal normal-case">
                  <input type="checkbox" checked={!!config.kyeshiResetsEachTime} className="w-3.5 h-3.5 accent-primary"
                    onChange={e => setConfig({ ...config, kyeshiResetsEachTime: e.target.checked })} />
                  {t('kyeshiResetsEachTimeLabel')}
                </span>
              </label>
              <InputField label="" value={config.kyeshiTime} onChange={(v: number) => setConfig({...config, kyeshiTime: v})} type="number" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                {t('autoCallStageSecondsLabel')}
              </label>
              <InputField label="" value={config.autoCallStageSeconds ?? 3} onChange={(v: number) => setConfig({...config, autoCallStageSeconds: v})} type="number" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                {t('gamjeomLimitLabel')}
                <span className="flex items-center gap-1.5 font-normal normal-case">
                  <input type="checkbox" checked={config.enforceGamjeomLimit !== false} className="w-3.5 h-3.5 accent-primary"
                    onChange={e => setConfig({ ...config, enforceGamjeomLimit: e.target.checked })} />
                  {t('enabledLabel')}
                </span>
              </label>
              <input type="number" value={config.gamjeomLimit} disabled={config.enforceGamjeomLimit === false}
                onChange={e => setConfig({ ...config, gamjeomLimit: Number(e.target.value) })}
                className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground disabled:opacity-40" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                {t('penaltySchemeLabel')}
              </label>
              <div className="flex rounded-lg overflow-hidden border border-border">
                <button type="button" onClick={() => setConfig({ ...config, penaltyScheme: 'binary' })}
                  className={`flex-1 px-2 py-2 text-xs font-semibold transition-colors ${(config.penaltyScheme ?? 'binary') === 'binary' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'}`}>
                  {t('penaltySchemeBinary')}
                </button>
                <button type="button" onClick={() => setConfig({ ...config, penaltyScheme: 'single' })}
                  className={`flex-1 px-2 py-2 text-xs font-semibold transition-colors ${config.penaltyScheme === 'single' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'}`}>
                  {t('penaltySchemeSingle')}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{t('penaltySchemeDesc')}</p>
            </div>
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/[.04] p-3 col-span-2">
              <div className="text-xs font-display font-black text-yellow-300 uppercase tracking-wider mb-2">TURNING HEAD SCORE</div>
              <div className="text-[10px] text-muted-foreground mb-2">اختر قيمة الركلة الدورانية للرأس في البطولة/المباراة: +5 أو +6.</div>
              <div className="grid grid-cols-2 gap-2">
                {[5, 6].map(points => (
                  <button key={points} type="button" onClick={() => setConfig({ ...config, turningHeadPoints: points as 5 | 6 })}
                    className={`px-3 py-2 rounded-lg text-xs font-black border transition-colors ${(config.turningHeadPoints ?? DEFAULT_CONFIG.turningHeadPoints) === points ? 'border-yellow-300 bg-yellow-400/20 text-yellow-200' : 'border-border text-muted-foreground bg-secondary/40'}`}>
                    +{points} POINTS
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                {t('pointGapLabel')}
                <span className="flex items-center gap-1.5 font-normal normal-case">
                  <input type="checkbox" checked={config.pointGap > 0} className="w-3.5 h-3.5 accent-primary"
                    onChange={e => {
                      if (e.target.checked) setConfig({ ...config, pointGap: lastPointGap });
                      else { if (config.pointGap > 0) setLastPointGap(config.pointGap); setConfig({ ...config, pointGap: 0 }); }
                    }} />
                  {t('enabledLabel')}
                </span>
              </label>
              <input type="number" value={config.pointGap} disabled={config.pointGap === 0 && lastPointGap === 0}
                onChange={e => { const v = Number(e.target.value); setConfig({ ...config, pointGap: v }); if (v > 0) setLastPointGap(v); }}
                className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground disabled:opacity-40" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                {t('pointCeilingLabel')}
                <span className="flex items-center gap-1.5 font-normal normal-case">
                  <input type="checkbox" checked={config.pointCeiling > 0} className="w-3.5 h-3.5 accent-primary"
                    onChange={e => {
                      if (e.target.checked) setConfig({ ...config, pointCeiling: lastPointCeiling });
                      else { if (config.pointCeiling > 0) setLastPointCeiling(config.pointCeiling); setConfig({ ...config, pointCeiling: 0 }); }
                    }} />
                  {t('enabledLabel')}
                </span>
              </label>
              <input type="number" value={config.pointCeiling} disabled={config.pointCeiling === 0 && lastPointCeiling === 0}
                onChange={e => { const v = Number(e.target.value); setConfig({ ...config, pointCeiling: v }); if (v > 0) setLastPointCeiling(v); }}
                className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground disabled:opacity-40" />
              <p className="text-[10px] text-muted-foreground mt-1">{t('pointCeilingHint')}</p>
            </div>
            <InputField label={t('ivrDefaultLabel')} value={config.ivrQuota} onChange={(v: number) => setConfig({...config, ivrQuota: v})} type="number" />
            <InputField label={t('ivrChungLabel')} value={config.ivrQuotaChung ?? config.ivrQuota} onChange={(v: number) => setConfig({...config, ivrQuotaChung: v})} type="number" />
            <InputField label={t('ivrHongLabel')} value={config.ivrQuotaHong ?? config.ivrQuota} onChange={(v: number) => setConfig({...config, ivrQuotaHong: v})} type="number" />
            <InputField label={t('judgeCountLabel')} value={config.judgeCount} onChange={(v: number) => setConfig({...config, judgeCount: v})} type="number" />
            <InputField label={t('ptgDisplayLabel')} value={config.ptgDisplayDuration} onChange={(v: number) => setConfig({...config, ptgDisplayDuration: v})} type="number" />
            <InputField label="Round Result Reveal (sec)" value={config.roundResultRevealSeconds ?? 2} onChange={(v: number) => setConfig({...config, roundResultRevealSeconds: Math.max(0, v)})} type="number" />
          </div>

          {/* Golden Point Round toggle */}
          <label className="mt-4 flex items-start gap-3 p-3 rounded-lg border border-accent/40 bg-accent/5 cursor-pointer hover:bg-accent/10 transition">
            <input
              type="checkbox"
              checked={config.goldenRound}
              onChange={e => setConfig({ ...config, goldenRound: e.target.checked })}
              className="mt-1 w-4 h-4 accent-primary"
            />
            <div className="flex-1">
              <div className="text-sm font-bold text-foreground">{t('goldenRoundTitle')}</div>
              <div className="text-xs text-muted-foreground mt-1 leading-relaxed space-y-1">
                <div><strong className="text-accent">{t('goldenRoundWhenLabel')}</strong> {t('goldenRoundWhenText')}</div>
                <div><strong className="text-accent">{t('goldenRoundHowLabel')}</strong> {t('goldenRoundHowText')}</div>
              </div>
            </div>
          </label>

          {/* Practice/Training Mode */}
          <label className="mt-4 flex items-start gap-3 p-3 rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/5 cursor-pointer hover:bg-[hsl(var(--warning))]/10 transition">
            <input
              type="checkbox"
              checked={!!config.trainingMode}
              onChange={e => setConfig({ ...config, trainingMode: e.target.checked })}
              className="mt-1 w-4 h-4 accent-primary"
            />
            <div className="flex-1">
              <div className="text-sm font-bold text-foreground">🎓 PRACTICE / TRAINING MODE</div>
              <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                واجهة الحكم كاملة كتخدم عادي (تسجيل نقط، gam-jeom، WOO-SE-GIROK...) لكن
                يبان علامة "TRAINING" واضحة فالشاشتين، والماتش ماكيتسجلش فالأرشيف
                الرسمي (لا نتيجة محفوظة، لا ميدالية، لا تحديث لترتيب النوادي). مناسب
                لتكوين حكام جدد بلا ما يخلطو بيانات تدريب مع بطولة حقيقية.
              </div>
            </div>
          </label>

          {/* Individual round-tie / WOO-SE-GIROK settings */}
          <div className="mt-4 rounded-xl border-2 border-[hsl(var(--gold))]/30 bg-[hsl(var(--gold))]/[.04] p-4">
            <div className="text-sm font-display font-black text-[hsl(var(--gold))] tracking-wider">ROUND TIE / WOO-SE-GIROK</div>
            <div className="text-[10px] text-muted-foreground mt-1 mb-3">INDIVIDUAL MATCH only. AI is recommendation-only; the referee remains the final authority.</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {([['roundTieAiAnalysisEnabled','ENABLE AI TIE ANALYSIS'],['roundTieWooSeGirokEnabled','ENABLE WOO-SE-GIROK'],['roundTieRefereeMajorityEnabled','ENABLE REFEREE MAJORITY'],['roundTieBroadcastAnimationEnabled','ENABLE BROADCAST ANIMATION']] as const).map(([key,label]) => (
                <label key={key} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={config[key] !== false} onChange={e => setConfig({ ...config, [key]: e.target.checked })} className="w-4 h-4 accent-primary" />
                  <span className="text-[10px] font-black">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Side judge score approval mode — same setting the Operator
              screen can flip live mid-match, exposed here too so it can be
              set as part of the match's initial rules, before the bout
              even starts. */}
          <label className="mt-4 flex items-start gap-3 p-3 rounded-lg border border-accent/40 bg-accent/5 cursor-pointer hover:bg-accent/10 transition">
            <input
              type="checkbox"
              checked={config.autoApproveJudgeScores}
              onChange={e => setConfig({ ...config, autoApproveJudgeScores: e.target.checked })}
              className="mt-1 w-4 h-4 accent-primary"
            />
            <div className="flex-1">
              <div className="text-sm font-bold text-foreground">{t('autoApproveTitle')}</div>
              <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {t('autoApproveDesc')}
              </div>
            </div>
          </label>
        </div>

        {/* Call Cinematic Timing — every field here (playerCall / teamCall
            timing seconds + teamCallAutoEnabled) already existed on
            MatchConfig and was fully read by the call-sequence logic in
            MatchContext, but had zero UI anywhere to actually change it —
            always silently stuck on its DEFAULT_CONFIG value. */}
        <div className="panel p-4">
          <h2 className="font-display text-sm font-bold text-foreground mb-1">{t('callTimingTitle')}</h2>
          <p className="text-[11px] text-muted-foreground mb-3">{t('callTimingSubtitle')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InputField label={t('playerCallBlueSecondsLabel')} value={config.playerCallBlueSeconds ?? 3} onChange={(v: number) => setConfig({...config, playerCallBlueSeconds: v})} type="number" />
            <InputField label={t('playerCallRedSecondsLabel')} value={config.playerCallRedSeconds ?? 3} onChange={(v: number) => setConfig({...config, playerCallRedSeconds: v})} type="number" />
            <InputField label={t('playerCallReadyDelaySecondsLabel')} value={config.playerCallReadyDelaySeconds ?? 3} onChange={(v: number) => setConfig({...config, playerCallReadyDelaySeconds: v})} type="number" />
            <InputField label={t('playerCallGoLiveDelaySecondsLabel')} value={config.playerCallGoLiveDelaySeconds ?? 3} onChange={(v: number) => setConfig({...config, playerCallGoLiveDelaySeconds: v})} type="number" />
            <InputField label={t('teamCallBlueSecondsLabel')} value={config.teamCallBlueSeconds ?? 3} onChange={(v: number) => setConfig({...config, teamCallBlueSeconds: v})} type="number" />
            <InputField label={t('teamCallRedSecondsLabel')} value={config.teamCallRedSeconds ?? 3} onChange={(v: number) => setConfig({...config, teamCallRedSeconds: v})} type="number" />
            <InputField label={t('teamCallReadyDelaySecondsLabel')} value={config.teamCallReadyDelaySeconds ?? 3} onChange={(v: number) => setConfig({...config, teamCallReadyDelaySeconds: v})} type="number" />
            <InputField label={t('teamCallGoLiveDelaySecondsLabel')} value={config.teamCallGoLiveDelaySeconds ?? 2} onChange={(v: number) => setConfig({...config, teamCallGoLiveDelaySeconds: v})} type="number" />
          </div>
          <label className="mt-3 flex items-center gap-2 p-2 rounded-lg border border-border bg-secondary/40 cursor-pointer hover:bg-secondary/70 transition w-fit">
            <input type="checkbox" checked={config.teamCallAutoEnabled !== false}
              onChange={e => setConfig({ ...config, teamCallAutoEnabled: e.target.checked })}
              className="w-4 h-4 accent-primary" />
            <span className="text-xs font-semibold text-foreground">{t('teamCallAutoEnabledLabel')}</span>
          </label>
        </div>

        {/* Super Fight / Direct Finals settings */}
        {config.competitionMode === 'super_fight' && (
          <div className="panel p-4 space-y-4 border-2 border-accent/30">
            <h2 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
              {t('superFightSettingsTitle')}
            </h2>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {t('superFightMatchmakerHint')}
            </p>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                {t('superFightStructureLabel')}
              </label>
              <div className="grid grid-cols-1 gap-2">
                <button type="button"
                  onClick={() => setConfig({ ...config, superFightStructure: 'independent_finals' })}
                  className={`w-full text-left px-3 py-3 rounded-lg border transition-colors ${(config.superFightStructure ?? 'independent_finals') === 'independent_finals' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary/40 text-muted-foreground'}`}>
                  <div className="text-xs font-black">🥇 {t('superFightIndependentFinals')}</div>
                </button>
                <button type="button"
                  onClick={() => setConfig({ ...config, superFightStructure: 'mini_knockout' })}
                  className={`w-full text-left px-3 py-3 rounded-lg border transition-colors ${config.superFightStructure === 'mini_knockout' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary/40 text-muted-foreground'}`}>
                  <div className="text-xs font-black">🏆 {t('superFightMiniKnockout')}</div>
                </button>
              </div>
            </div>

            {(config.superFightStructure ?? 'independent_finals') === 'independent_finals' && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                  {t('superFightSecondMatchMedalLabel')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setConfig({ ...config, superFightIndependentSecondMatchMedal: 'gold_silver' })}
                    className={`px-3 py-2 rounded-lg text-xs font-black border transition-colors ${(config.superFightIndependentSecondMatchMedal ?? 'gold_silver') === 'gold_silver' ? 'border-yellow-300 bg-yellow-400/15 text-yellow-200' : 'border-border text-muted-foreground bg-secondary/40'}`}>
                    🥇 {t('superFightSecondMatchGoldSilver')}
                  </button>
                  <button type="button" onClick={() => setConfig({ ...config, superFightIndependentSecondMatchMedal: 'bronze_third' })}
                    className={`px-3 py-2 rounded-lg text-xs font-black border transition-colors ${config.superFightIndependentSecondMatchMedal === 'bronze_third' ? 'border-orange-400 bg-orange-400/15 text-orange-200' : 'border-border text-muted-foreground bg-secondary/40'}`}>
                    🥉 {t('superFightSecondMatchBronze')}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <label className="flex items-start gap-2 p-3 rounded-lg border border-border bg-secondary/30 cursor-pointer">
                <input type="checkbox" checked={config.superFightSeparateAgeGroups !== false}
                  onChange={e => setConfig({ ...config, superFightSeparateAgeGroups: e.target.checked })}
                  className="mt-0.5 w-4 h-4 accent-primary" />
                <span><span className="text-xs font-bold text-foreground block">{t('superFightSeparateAgeGroupsLabel')}</span><span className="text-[10px] text-muted-foreground">{t('superFightSeparateAgeGroupsDesc')}</span></span>
              </label>
              <label className="flex items-start gap-2 p-3 rounded-lg border border-border bg-secondary/30 cursor-pointer">
                <input type="checkbox" checked={config.superFightAvoidSameClub !== false}
                  onChange={e => setConfig({ ...config, superFightAvoidSameClub: e.target.checked })}
                  className="mt-0.5 w-4 h-4 accent-primary" />
                <span><span className="text-xs font-bold text-foreground block">{t('superFightAvoidSameClubLabel')}</span><span className="text-[10px] text-muted-foreground">{t('superFightAvoidSameClubDesc')}</span></span>
              </label>
            </div>
          </div>
        )}

        {/* Par Équipe (Team Mode) settings — appears the moment Competition
            Type above is set to "par_equipe", so every team-related setting
            (team identity, roster, substitution mode, call-animation photo
            toggle) is available right here without leaving Admin. */}
        {config.competitionMode === 'par_equipe' && (
          <div className="panel p-4 space-y-4 border-2 border-primary/30">
            <h2 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
              {t('parEquipeSetupTitle')}
            </h2>

            {/* TOURNAMENT INFORMATION — spec §35: Tournament Name/Competition/
                Category/Age/Weight already live in the shared fields above
                this panel; Division is Par Équipe-only, so it's kept here
                next to the team settings instead of cluttering the shared
                Individual-match fields. */}
            <div>
              <h3 className="text-[10px] font-display font-black uppercase tracking-wider text-muted-foreground mb-2">
                {t('tournamentInfoSectionLabel')}
              </h3>
              <InputField label={t('divisionLabel') || 'Division'} value={divisionVal} onChange={setDivisionVal} placeholder={t('divisionPlaceholder') || 'e.g. Cadet Team Division B'} />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                {t('playerManagementModeLabel')}
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => setTeamMode('rotation')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border ${teamMode === 'rotation' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                  {t('rotationModeLabel')}
                </button>
                <button type="button" onClick={() => setTeamMode('substitution')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border ${teamMode === 'substitution' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                  {t('substitutionModeLabel')}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/[.04] p-3">
              <div className="text-xs font-display font-black text-yellow-300 uppercase tracking-wider mb-2">PAR ÉQUIPE — SCORE RULES</div>
              <div className="text-[10px] text-muted-foreground mb-2">Turning Head value is controlled by the Main Referee tournament rule. Judges send the technique request; the official value below is applied to the score.</div>
              <div className="grid grid-cols-2 gap-2">
                {[5,6].map(points => (
                  <button key={points} type="button" onClick={() => setConfig({ ...config, turningHeadPoints: points as 5 | 6 })}
                    className={`px-3 py-2 rounded-lg text-xs font-black border transition-colors ${(config.turningHeadPoints ?? DEFAULT_CONFIG.turningHeadPoints) === points ? 'border-yellow-300 bg-yellow-400/20 text-yellow-200' : 'border-border text-muted-foreground bg-secondary/40'}`}>
                    TURNING HEAD +{points}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[9px] text-yellow-100/60">Judge request +{config.turningHeadPoints ?? DEFAULT_CONFIG.turningHeadPoints} → official tournament score +{config.turningHeadPoints ?? DEFAULT_CONFIG.turningHeadPoints}</div>
            </div>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30 cursor-pointer">
              <input type="checkbox" checked={!config.scoreResetPerRound} className="mt-1 w-4 h-4 accent-primary"
                onChange={e => setConfig({ ...config, scoreResetPerRound: !e.target.checked })} />
              <div>
                <div className="text-sm font-bold text-foreground">{t('carryScoreTitle')}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t('carryScoreDesc')}
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30 cursor-pointer">
              <input type="checkbox" checked={config.warningResetPerRound ?? true} className="mt-1 w-4 h-4 accent-primary"
                onChange={e => setConfig({ ...config, warningResetPerRound: e.target.checked })} />
              <div>
                <div className="text-sm font-bold text-foreground">Warnings reset each round</div>
                <div className="text-xs text-muted-foreground mt-1">0 = reset after the round · OFF = warnings remain active in the next round</div>
              </div>
            </label>

            <div className="rounded-xl border-2 border-primary/30 bg-primary/[.035] p-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <div className="text-sm font-display font-black text-foreground">PLAYER CHANGE ANIMATION</div>
                  <div className="text-[10px] text-muted-foreground mt-1">اختيار طريقة تغيير اللاعب وسط الجولة في Par Équipe</div>
                </div>
                <div className={`px-2.5 py-1 rounded-full text-[9px] font-black ${config.playerChangeAnimation !== false ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-white/5 text-white/50 border border-white/10'}`}>
                  {config.playerChangeAnimation !== false ? 'ANIMATION ON' : 'DIRECT OFF'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfig({ ...config, playerChangeAnimation: true })}
                  className={`rounded-lg border px-3 py-2 text-xs font-black ${config.playerChangeAnimation !== false ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground'}`}>
                  ON — OUT → IN
                </button>
                <button type="button" onClick={() => setConfig({ ...config, playerChangeAnimation: false })}
                  className={`rounded-lg border px-3 py-2 text-xs font-black ${config.playerChangeAnimation === false ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300' : 'border-border text-muted-foreground'}`}>
                  OFF — DIRECT
                </button>
              </div>
              <div className="mt-2 text-[9px] text-muted-foreground">
                ON: يتوقف الوقت وتظهر Animation التبديل. OFF: لا Animation، لا يتوقف الوقت، وتتغير بيانات اللاعب مباشرة في المباراة الحية.
              </div>
            </div>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30 cursor-pointer">
              <input type="checkbox" checked={config.showRosterPhotosInTeamCall} className="mt-1 w-4 h-4 accent-primary"
                onChange={e => {
                  setConfig({ ...config, showRosterPhotosInTeamCall: e.target.checked });
                  // Keep the live "شاشة الاستدعاء" toggle (Public Display panel,
                  // applies instantly mid-match) in sync with this pre-match
                  // default, so the two controls never silently disagree.
                  dispatch({ type: 'SET_CALL_DISPLAY_CONFIG', callDisplayConfig: { showRosterPhotos: e.target.checked } });
                }} />
              <div>
                <div className="text-sm font-bold text-foreground">{t('showRosterPhotosTitle')}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t('showRosterPhotosDesc')}
                </div>
              </div>
            </label>

            {(['chung', 'hong'] as const).map(side => {
              const isChung = side === 'chung';
              const accent = isChung ? 'hsl(210 80% 55%)' : 'hsl(0 75% 55%)';
              const roster = isChung ? teamRosterChung : teamRosterHong;
              return (
                <div key={side} className="rounded-xl border p-3 space-y-3" style={{ borderColor: accent }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-display font-bold uppercase tracking-wide" style={{ color: accent }}>
                      {isChung ? `${t('chungTeamLabel')} — ${t('redTeamLabel') || 'RED TEAM'}` : `${t('hongTeamLabel')} — ${t('blueTeamLabel') || 'BLUE TEAM'}`}
                    </h3>
                    {/* Number of Individual Matches (spec §35): derived from
                        roster length rather than a separately stored field —
                        the rotation engine (getRotationEntryForRound) already
                        drives one individual encounter per roster slot, so a
                        second, independently-editable number would risk
                        drifting out of sync with what actually plays out. */}
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      {roster.length} {t('individualMatchesCountLabel') || 'individual matches'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label={t('teamClubNameLabel')}
                      value={isChung ? teamNameChung : teamNameHong}
                      onChange={isChung ? setTeamNameChung : setTeamNameHong} placeholder={t('clubPlaceholder')} />
                    <div>
                      <label className="text-xs text-muted-foreground font-semibold block mb-1">{t('countryLabel')}</label>
                      <CountryPicker value={isChung ? teamCountryChung : teamCountryHong}
                        onChange={isChung ? setTeamCountryChung : setTeamCountryHong} placeholder={t('countryLabel')} />
                    </div>
                  </div>
                  <InputField label={t('coachLabel') || 'Coach'}
                    value={isChung ? coachChung : coachHong}
                    onChange={isChung ? setCoachChung : setCoachHong} placeholder={t('coachPlaceholder') || 'Coach name'} />
                  <PhotoUploadField id={`team-logo-${side}`} label={t('teamLogoFieldLabel')}
                    value={isChung ? teamLogoChung : teamLogoHong}
                    onChange={isChung ? setTeamLogoChung : setTeamLogoHong} changeLabel={t('changePhotoLabel')} uploadLabel={t('uploadPhotoLabel')} />
                  <PhotoUploadField id={`club-logo-${side}`} label={t('clubLogoFieldLabel')}
                    value={isChung ? clubLogoChung : clubLogoHong}
                    onChange={isChung ? setClubLogoChung : setClubLogoHong} changeLabel={t('changePhotoLabel')} uploadLabel={t('uploadPhotoLabel')} />
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold block mb-1">{t('rosterFieldLabel')}</label>
                    <RosterEditor players={roster}
                      onChange={isChung ? setTeamRosterChung : setTeamRosterHong} accentColor={accent}
                      namePlaceholder={t('playerNamePlaceholder')} natPlaceholder={t('natShortPlaceholder')}
                      tournamentId={state.tournamentId} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* IVR withdrawal log */}
        <div className="panel p-4">
          <button
            onClick={() => setShowIvrLog(s => !s)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <h2 className="font-display text-sm font-bold text-foreground">{t('ivrWithdrawalTitle')}</h2>
              <p className="text-[11px] text-muted-foreground">{t('ivrWithdrawalDesc')}</p>
            </div>
            <span className="text-xs text-accent font-bold">{ivrLog.length} {t('entriesLabel')} {showIvrLog ? '▲' : '▼'}</span>
          </button>
          {showIvrLog && (
            <div className="mt-3 max-h-64 overflow-y-auto space-y-1.5">
              {ivrLog.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">{t('noRejectedChallenges')}</div>}
              {[...ivrLog].reverse().map(e => (
                <div key={e.id} className="text-xs p-2 rounded-lg border border-border bg-secondary/40 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold truncate">
                      <span className={e.side === 'chung' ? 'text-chung' : 'text-hong'}>
                        {e.side === 'chung' ? `● ${t('chung')}` : `● ${t('hong')}`}
                      </span>
                      {' — '}{e.playerName}{e.coachName ? ` (coach: ${e.coachName})` : ''}
                    </div>
                    <div className="text-muted-foreground truncate">{e.reason}</div>
                    <div className="text-[10px] text-muted-foreground/70">
                      {e.competitionName ? `${e.competitionName} • ` : ''}{t('match')} #{e.matchNumber ?? '—'} • {new Date(e.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded bg-warning/20 text-warning text-[10px] font-bold">
                    {e.remainingCards} {t('remainingLeftLabel')}
                  </span>
                </div>
              ))}
              {ivrLog.length > 0 && (
                <button
                  onClick={() => { localStorage.removeItem('tkd-ivr-log'); setIvrLog([]); }}
                  className="w-full mt-1 py-1.5 text-[11px] text-muted-foreground hover:text-destructive"
                >{t('clearLogLabel')}</button>
              )}
            </div>
          )}
        </div>


        {/* Save */}
        <button
          onClick={handleSave}
          className="btn-power w-full py-3 rounded-xl font-display flex items-center justify-center gap-2"
        >
          <Save size={18} /> {saved ? t('savedLabel') : t('saveApplyLabel')}
        </button>
        {saveError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive text-destructive text-xs font-semibold">
            {t('saveFailedLabel')} {saveError} — {t('saveFailedHint')}
          </div>
        )}
      </div>
      {showCategoryBrowser && (
        <CategoryMatchBrowser
          onClose={() => setShowCategoryBrowser(false)}
          onMatchCreated={({ tournamentId, tournamentName }) => {
            // The new match is already saved (cloud/local) inside its category
            // tournament — just point this Admin form's tournament link at it
            // so a later Save here attaches to the same bucket instead of
            // forking a new one.
            setPickedTournament({ id: tournamentId, name: tournamentName });
          }}
        />
      )}
    </div>
  );
}
